mod api;
mod db;
mod tunnel;
mod proxy;
mod auth;
mod config;

use actix_cors::Cors;
use actix_web::{web, App, HttpServer, middleware::Logger};
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct AppState {
    pub db: db::Database,
    pub tunnel_manager: Arc<RwLock<tunnel::TunnelManager>>,
    pub config: config::ServerConfig,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let config = config::ServerConfig::from_env();
    let db = db::Database::new(&config.database_url)
        .await
        .expect("Failed to connect to database");

    db.run_migrations().await.expect("Failed to run migrations");

    let tunnel_manager = Arc::new(RwLock::new(tunnel::TunnelManager::new()));

    let state = web::Data::new(AppState {
        db,
        tunnel_manager,
        config: config.clone(),
    });

    log::info!("🚀 SelfHost server starting on {}:{}", config.host, config.port);
    log::info!("📡 Base domain: {}", config.base_domain);

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
            // Auth routes (no auth middleware)
            .service(
                web::scope("/api/auth")
                    .route("/register", web::post().to(api::auth::register))
                    .route("/login", web::post().to(api::auth::login)),
            )
            // Protected API routes
            .service(
                web::scope("/api")
                    .wrap(auth::AuthMiddlewareFactory)
                    .route("/apps", web::get().to(api::apps::list_apps))
                    .route("/apps", web::post().to(api::apps::create_app))
                    .route("/apps/{id}", web::get().to(api::apps::get_app))
                    .route("/apps/{id}", web::put().to(api::apps::update_app))
                    .route("/apps/{id}", web::delete().to(api::apps::delete_app))
                    .route("/apps/{id}/start", web::post().to(api::apps::start_app))
                    .route("/apps/{id}/stop", web::post().to(api::apps::stop_app))
                    .route("/me", web::get().to(api::auth::me))
                    .route("/agent/config", web::get().to(api::agent::get_config)),
            )
            // WebSocket tunnel endpoint (auth via query param)
            .route("/ws/tunnel", web::get().to(tunnel::ws_tunnel_handler))
            // Serve frontend static files
            .service(
                actix_files::Files::new("/", "./static")
                    .index_file("index.html")
                    .default_handler(web::to(api::spa_fallback)),
            )
    })
    .bind(format!("{}:{}", config.host, config.port))?
    .run()
    .await
}
