use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use shared::models::*;
use crate::AppState;
use crate::auth::Claims;

/// GET /api/agent/config — returns the config the agent needs to connect
pub async fn get_config(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> HttpResponse {
    let claims = req.extensions().get::<Claims>().unwrap().clone();

    match state.db.get_user_by_id(&claims.sub).await {
        Ok(Some(user)) => {
            let config = AgentConfig {
                server_url: format!(
                    "ws://{}:{}/ws/tunnel",
                    state.config.host, state.config.port
                ),
                api_key: user.api_key,
                agent_id: format!("agent_{}", new_id()),
            };
            HttpResponse::Ok().json(ApiResponse::ok(config))
        }
        _ => HttpResponse::NotFound().json(ApiResponse::<()>::err("User not found")),
    }
}
