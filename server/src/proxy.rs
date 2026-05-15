use actix_web::{web, HttpRequest, HttpResponse};
use shared::tunnel::TunnelMessage;
use std::collections::HashMap;
use crate::AppState;

/// Handle an incoming request that targets a subdomain.
/// This is called when the reverse proxy detects a subdomain in the Host header.
///
/// Flow:
/// 1. Extract subdomain from Host header
/// 2. Look up the app by subdomain
/// 3. Find the active tunnel for the app's owner
/// 4. Forward the HTTP request through the WebSocket tunnel
/// 5. Wait for the agent's response and return it to the client
pub async fn handle_proxy_request(
    req: HttpRequest,
    body: web::Bytes,
    state: web::Data<AppState>,
    subdomain: &str,
) -> HttpResponse {
    // Look up the app
    let app = match state.db.get_app_by_subdomain(subdomain).await {
        Ok(Some(app)) => app,
        Ok(None) => {
            return HttpResponse::NotFound().body(format!(
                "No app found for subdomain: {}.{}",
                subdomain, state.config.base_domain
            ));
        }
        Err(e) => {
            log::error!("DB error looking up subdomain {}: {}", subdomain, e);
            return HttpResponse::InternalServerError().body("Internal server error");
        }
    };

    // Check if agent is connected
    let tunnel_mgr = state.tunnel_manager.read().await;
    let sender = match tunnel_mgr.get_sender(&app.user_id) {
        Some(s) => s.clone(),
        None => {
            return HttpResponse::ServiceUnavailable().body(
                "The host for this app is currently offline. Please try again later.",
            );
        }
    };
    drop(tunnel_mgr);

    // Build the tunnel request
    let request_id = shared::models::new_id();
    let mut headers = HashMap::new();
    for (key, value) in req.headers() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }

    let tunnel_req = TunnelMessage::HttpRequest {
        request_id: request_id.clone(),
        subdomain: subdomain.to_string(),
        method: req.method().to_string(),
        path: req.uri().path_and_query().map(|p| p.to_string()).unwrap_or_else(|| "/".to_string()),
        headers,
        body: if body.is_empty() {
            None
        } else {
            Some(body.to_vec())
        },
    };

    // Register a oneshot channel for the response
    let (resp_tx, resp_rx) = tokio::sync::oneshot::channel();
    {
        let mut mgr = state.tunnel_manager.write().await;
        mgr.register_pending_request(request_id.clone(), resp_tx);
    }

    // Send through tunnel
    let msg = serde_json::to_string(&tunnel_req).unwrap();
    if sender.send(msg).await.is_err() {
        let mut mgr = state.tunnel_manager.write().await;
        mgr.cancel_pending_request(&request_id);
        return HttpResponse::BadGateway().body("Failed to forward request to agent");
    }

    // Wait for response with timeout
    match tokio::time::timeout(std::time::Duration::from_secs(30), resp_rx).await {
        Ok(Ok(TunnelMessage::HttpResponse {
            status_code,
            headers,
            body,
            ..
        })) => {
            let mut response = HttpResponse::build(
                actix_web::http::StatusCode::from_u16(status_code)
                    .unwrap_or(actix_web::http::StatusCode::INTERNAL_SERVER_ERROR),
            );

            for (key, value) in &headers {
                if key.to_lowercase() != "transfer-encoding" {
                    response.insert_header((key.as_str(), value.as_str()));
                }
            }

            match body {
                Some(b) => response.body(b),
                None => response.finish(),
            }
        }
        Ok(Ok(_)) => HttpResponse::BadGateway().body("Unexpected response from agent"),
        Ok(Err(_)) => HttpResponse::BadGateway().body("Agent connection dropped"),
        Err(_) => HttpResponse::GatewayTimeout().body("Request timed out (30s)"),
    }
}

/// Extract the subdomain from a Host header value.
/// e.g., "myapp.selfhost.example.com" with base "selfhost.example.com" → "myapp"
pub fn extract_subdomain(host: &str, base_domain: &str) -> Option<String> {
    let host = host.split(':').next().unwrap_or(host); // strip port
    let suffix = format!(".{}", base_domain);
    if host.ends_with(&suffix) && host.len() > suffix.len() {
        let subdomain = &host[..host.len() - suffix.len()];
        if !subdomain.is_empty() && !subdomain.contains('.') {
            return Some(subdomain.to_string());
        }
    }
    None
}
