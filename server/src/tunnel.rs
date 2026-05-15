use actix_web::{web, HttpRequest, HttpResponse};
use actix_ws::Message;
use futures_util::StreamExt as _;
use std::collections::HashMap;
use tokio::sync::mpsc;
use shared::tunnel::TunnelMessage;
use crate::AppState;

/// Manages active WebSocket tunnels, keyed by user_id.
pub struct TunnelManager {
    /// Map from user_id → channel sender to push messages to the agent
    senders: HashMap<String, mpsc::Sender<String>>,
    /// Map from request_id → oneshot sender to deliver HTTP responses
    pending_requests: HashMap<String, tokio::sync::oneshot::Sender<TunnelMessage>>,
}

impl TunnelManager {
    pub fn new() -> Self {
        TunnelManager {
            senders: HashMap::new(),
            pending_requests: HashMap::new(),
        }
    }

    pub fn register(&mut self, user_id: String, sender: mpsc::Sender<String>) {
        log::info!("🔌 Agent connected for user: {}", user_id);
        self.senders.insert(user_id, sender);
    }

    pub fn unregister(&mut self, user_id: &str) {
        log::info!("🔌 Agent disconnected for user: {}", user_id);
        self.senders.remove(user_id);
    }

    pub fn get_sender(&self, user_id: &str) -> Option<&mpsc::Sender<String>> {
        self.senders.get(user_id)
    }

    pub fn is_connected(&self, user_id: &str) -> bool {
        self.senders.contains_key(user_id)
    }

    pub fn register_pending_request(
        &mut self,
        request_id: String,
        sender: tokio::sync::oneshot::Sender<TunnelMessage>,
    ) {
        self.pending_requests.insert(request_id, sender);
    }

    pub fn resolve_pending_request(
        &mut self,
        request_id: &str,
        response: TunnelMessage,
    ) -> bool {
        if let Some(sender) = self.pending_requests.remove(request_id) {
            let _ = sender.send(response);
            true
        } else {
            false
        }
    }

    pub fn cancel_pending_request(&mut self, request_id: &str) {
        self.pending_requests.remove(request_id);
    }
}

/// WebSocket tunnel endpoint: GET /ws/tunnel?api_key=...&agent_id=...
pub async fn ws_tunnel_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, actix_web::Error> {
    // Authenticate via query params
    let query = web::Query::<HashMap<String, String>>::from_query(req.query_string())
        .unwrap_or_else(|_| web::Query(HashMap::new()));

    let api_key = match query.get("api_key") {
        Some(k) => k.clone(),
        None => {
            return Ok(HttpResponse::Unauthorized().json(
                serde_json::json!({"error": "Missing api_key query parameter"}),
            ));
        }
    };

    let agent_id = query
        .get("agent_id")
        .cloned()
        .unwrap_or_else(|| format!("agent_{}", uuid::Uuid::new_v4()));

    // Look up user by API key
    let user = match state.db.get_user_by_api_key(&api_key).await {
        Ok(Some(u)) => u,
        _ => {
            return Ok(HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "Invalid API key"})));
        }
    };

    let user_id = user.id.clone();

    // Upgrade to WebSocket
    let (response, mut session, mut msg_stream) = actix_ws::handle(&req, stream)?;

    // Channel for server → agent messages
    let (tx, mut rx) = mpsc::channel::<String>(100);

    // Register this tunnel
    {
        let mut mgr = state.tunnel_manager.write().await;
        mgr.register(user_id.clone(), tx);
    }

    // Update DB
    let _ = state
        .db
        .upsert_tunnel(&agent_id, &user_id, &agent_id, true)
        .await;

    // Send auth confirmation
    let auth_ok = TunnelMessage::AuthOk {
        message: format!("Connected as user {}", user.username),
    };
    let _ = session
        .text(serde_json::to_string(&auth_ok).unwrap())
        .await;

    let state_clone = state.clone();
    let user_id_clone = user_id.clone();
    let agent_id_clone = agent_id.clone();

    // Spawn the WebSocket handler task
    actix_rt::spawn(async move {
        let state = state_clone;
        let user_id = user_id_clone;
        let agent_id = agent_id_clone;

        // Spawn a task to forward server→agent messages
        let mut session_clone = session.clone();
        let forward_task = actix_rt::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if session_clone.text(msg).await.is_err() {
                    break;
                }
            }
        });

        // Process incoming messages from agent
        while let Some(Ok(msg)) = msg_stream.next().await {
            match msg {
                Message::Text(text) => {
                    let text_str = text.to_string();
                    match serde_json::from_str::<TunnelMessage>(&text_str) {
                        Ok(TunnelMessage::Pong) => {
                            // Heartbeat response, update last_heartbeat
                            let _ = state
                                .db
                                .upsert_tunnel(&agent_id, &user_id, &agent_id, true)
                                .await;
                        }
                        Ok(TunnelMessage::HttpResponse { request_id, .. }) => {
                            // Resolve a pending HTTP request
                            let tunnel_msg: TunnelMessage =
                                serde_json::from_str(&text_str).unwrap();
                            let mut mgr = state.tunnel_manager.write().await;
                            mgr.resolve_pending_request(&request_id, tunnel_msg);
                        }
                        Ok(TunnelMessage::AgentCommandResult {
                            app_id,
                            success,
                            message,
                        }) => {
                            let new_status = if success { "running" } else { "error" };
                            let _ = state.db.update_app_status(&app_id, new_status).await;
                            log::info!(
                                "📦 App {} command result: {} - {}",
                                app_id,
                                success,
                                message
                            );
                        }
                        Ok(TunnelMessage::StatusReport { apps }) => {
                            for entry in apps {
                                let _ = state
                                    .db
                                    .update_app_status(&entry.app_id, &entry.status)
                                    .await;
                            }
                        }
                        Ok(other) => {
                            log::warn!("Unexpected tunnel message: {:?}", other);
                        }
                        Err(e) => {
                            log::warn!("Failed to parse tunnel message: {}", e);
                        }
                    }
                }
                Message::Ping(bytes) => {
                    let _ = session.pong(&bytes).await;
                }
                Message::Close(_) => {
                    break;
                }
                _ => {}
            }
        }

        // Cleanup on disconnect
        forward_task.abort();
        {
            let mut mgr = state.tunnel_manager.write().await;
            mgr.unregister(&user_id);
        }
        let _ = state.db.set_tunnel_disconnected(&agent_id).await;
        log::info!("🔌 Agent {} disconnected", agent_id);
    });

    Ok(response)
}
