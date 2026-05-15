pub mod auth;
pub mod apps;
pub mod agent;

use actix_web::{HttpRequest, HttpResponse};

/// SPA fallback — serves index.html for any unmatched route
/// so client-side routing works.
pub async fn spa_fallback(_req: HttpRequest) -> HttpResponse {
    match std::fs::read_to_string("./static/index.html") {
        Ok(content) => HttpResponse::Ok()
            .content_type("text/html; charset=utf-8")
            .body(content),
        Err(_) => HttpResponse::NotFound().body("Frontend not found"),
    }
}
