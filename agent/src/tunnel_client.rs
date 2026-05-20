use futures_util::{SinkExt, StreamExt};
use shared::tunnel::TunnelMessage;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::app_manager::AppManager;

pub async fn connect_and_run(
    server_url: &str,
    api_key: &str,
    agent_id: &str,
    app_mgr: &AppManager,
) -> Result<(), Box<dyn std::error::Error>> {
    // Build URL with auth query params
    let url = format!("{}?api_key={}&agent_id={}", server_url, api_key, agent_id);
    let url = url::Url::parse(&url)?;

    let (ws_stream, _) = connect_async(url).await?;
    log::info!("WebSocket connected");

    let (mut write, mut read) = ws_stream.split();

    // Create a thread-safe channel for sending messages to the WebSocket
    let (tx, mut rx) = tokio::sync::mpsc::channel::<Message>(32);

    // Dedicated writer task to handle sending messages sequentially
    let writer_handle = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Active heartbeat sender task (sends Ping every 30 seconds)
    let tx_heartbeat = tx.clone();
    let heartbeat_handle = tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
            log::debug!("Sending heartbeat Ping");
            let ping = TunnelMessage::Ping;
            if let Ok(msg) = serde_json::to_string(&ping) {
                if tx_heartbeat.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    // Process messages from server
    while let Some(msg_result) = read.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<TunnelMessage>(&text) {
                    Ok(TunnelMessage::AuthOk { message }) => {
                        log::info!("Authenticated: {}", message);
                    }
                    Ok(TunnelMessage::AuthError { message }) => {
                        log::error!("Auth failed: {}", message);
                        return Err(message.into());
                    }
                    Ok(TunnelMessage::HttpRequest {
                        request_id,
                        subdomain,
                        method,
                        path,
                        headers,
                        body,
                    }) => {
                        log::info!(
                            "Incoming request: {} {} (subdomain: {})",
                            method,
                            path,
                            subdomain
                        );

                        // Find the local port for this subdomain
                        let local_port = app_mgr.get_port_for_subdomain(&subdomain);

                        let response = if let Some(port) = local_port {
                            // Forward to local app
                            forward_to_local(port, &method, &path, &headers, body.as_deref()).await
                        } else {
                            // No app found for this subdomain
                            TunnelMessage::HttpResponse {
                                request_id: request_id.clone(),
                                status_code: 404,
                                headers: std::collections::HashMap::new(),
                                body: Some(b"App not found on this agent".to_vec()),
                            }
                        };

                        // Set the correct request_id
                        let response = match response {
                            TunnelMessage::HttpResponse {
                                status_code,
                                headers,
                                body,
                                ..
                            } => TunnelMessage::HttpResponse {
                                request_id,
                                status_code,
                                headers,
                                body,
                            },
                            other => other,
                        };

                        let msg = serde_json::to_string(&response).unwrap();
                        if tx.send(Message::Text(msg.into())).await.is_err() {
                            log::error!("Failed to send response through tunnel");
                            break;
                        }
                    }
                    Ok(TunnelMessage::AgentCommand {
                        command,
                        app_id,
                        app_name,
                        local_port,
                    }) => {
                        log::info!(
                            "Agent command: {:?} for app {} (port {})",
                            command,
                            app_name,
                            local_port
                        );

                        let (success, message) = match command {
                            shared::tunnel::AgentCommandType::Start => {
                                app_mgr.register_app(&app_id, &app_name, local_port);
                                (
                                    true,
                                    format!("App {} registered on port {}", app_name, local_port),
                                )
                            }
                            shared::tunnel::AgentCommandType::Stop => {
                                app_mgr.unregister_app(&app_id);
                                (true, format!("App {} stopped", app_name))
                            }
                            shared::tunnel::AgentCommandType::Restart => {
                                app_mgr.unregister_app(&app_id);
                                app_mgr.register_app(&app_id, &app_name, local_port);
                                (true, format!("App {} restarted", app_name))
                            }
                        };

                        let result = TunnelMessage::AgentCommandResult {
                            app_id,
                            success,
                            message,
                        };
                        let msg = serde_json::to_string(&result).unwrap();
                        if tx.send(Message::Text(msg.into())).await.is_err() {
                            break;
                        }
                    }
                    Ok(TunnelMessage::Ping) => {
                        let pong = TunnelMessage::Pong;
                        let msg = serde_json::to_string(&pong).unwrap();
                        let _ = tx.send(Message::Text(msg.into())).await;
                    }
                    Ok(other) => {
                        log::debug!("Received: {:?}", other);
                    }
                    Err(e) => {
                        log::warn!("Failed to parse message: {}", e);
                    }
                }
            }
            Ok(Message::Ping(data)) => {
                let _ = tx.send(Message::Pong(data)).await;
            }
            Ok(Message::Close(_)) => {
                log::info!("Server closed connection");
                break;
            }
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    heartbeat_handle.abort();
    writer_handle.abort();
    Ok(())
}

/// Forward an HTTP request to a local app running on the given port
async fn forward_to_local(
    port: u16,
    method: &str,
    path: &str,
    headers: &std::collections::HashMap<String, String>,
    body: Option<&[u8]>,
) -> TunnelMessage {
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{}{}", port, path);

    let mut req_builder = match method {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        "HEAD" => client.head(&url),
        _ => client.get(&url),
    };

    // Forward headers (except Host which should be localhost)
    for (key, value) in headers {
        let key_lower = key.to_lowercase();
        if key_lower != "host" && key_lower != "connection" && key_lower != "transfer-encoding" {
            req_builder = req_builder.header(key.as_str(), value.as_str());
        }
    }

    if let Some(body) = body {
        req_builder = req_builder.body(body.to_vec());
    }

    match req_builder.send().await {
        Ok(resp) => {
            let status_code = resp.status().as_u16();
            let mut resp_headers = std::collections::HashMap::new();
            for (key, value) in resp.headers() {
                if let Ok(v) = value.to_str() {
                    resp_headers.insert(key.to_string(), v.to_string());
                }
            }
            let body = resp.bytes().await.ok().map(|b| b.to_vec());

            TunnelMessage::HttpResponse {
                request_id: String::new(), // will be set by caller
                status_code,
                headers: resp_headers,
                body,
            }
        }
        Err(e) => {
            log::error!("Failed to forward to local app: {}", e);
            TunnelMessage::HttpResponse {
                request_id: String::new(),
                status_code: 502,
                headers: std::collections::HashMap::new(),
                body: Some(format!("Failed to reach local app: {}", e).into_bytes()),
            }
        }
    }
}
