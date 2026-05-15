mod db;
mod tunnel;
mod proxy;
mod config;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, HttpRequest, HttpResponse, middleware::Logger};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub db: db::Database,
    pub tunnel_manager: Arc<RwLock<tunnel::TunnelManager>>,
    pub config: config::ServerConfig,
}

async fn default_proxy_handler(
    req: HttpRequest,
    body: web::Bytes,
    state: web::Data<AppState>,
) -> HttpResponse {
    let host = req.headers().get("Host").and_then(|h| h.to_str().ok()).unwrap_or("");
    
    // Check if it's a subdomain request
    if let Some(subdomain) = proxy::extract_subdomain(host, &state.config.base_domain) {
        return proxy::handle_proxy_request(req, body, state, &subdomain).await;
    }

    // Default fallback if not a subdomain
    HttpResponse::NotFound().body("Not Found")
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let config = config::ServerConfig::from_env();
    let db = db::Database::new(&config.database_url)
        .await
        .expect("Failed to connect to database");

    // We don't need migrations here if the Express API will handle them eventually, 
    // but keeping it ensures the DB is set up if Rust starts first.
    db.run_migrations().await.expect("Failed to run migrations");

    let tunnel_manager = Arc::new(RwLock::new(tunnel::TunnelManager::new()));

    let state = web::Data::new(AppState {
        db,
        tunnel_manager,
        config: config.clone(),
    });

    log::info!("SelfHost Proxy & Tunnel server starting on {}:{}", config.host, config.port);
    log::info!("Base domain: {}", config.base_domain);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .app_data(state.clone())
            .wrap(Logger::default())
            .wrap(cors)
            // WebSocket tunnel endpoint (auth via query param)
            .route("/ws/tunnel", web::get().to(tunnel::ws_tunnel_handler))
            // Default handler for all other traffic (will handle subdomains via reverse proxy)
            .default_service(web::route().to(default_proxy_handler))
    })
    .bind(format!("{}:{}", config.host, config.port))?
    .run()
    .await
}
