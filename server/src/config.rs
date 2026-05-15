#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub base_domain: String,
}

impl ServerConfig {
    pub fn from_env() -> Self {
        ServerConfig {
            host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .expect("PORT must be a number"),
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "sqlite:selfhost.db?mode=rwc".to_string()),
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_else(|_| "abcdefghi".to_string()),
            base_domain: std::env::var("BASE_DOMAIN")
                .unwrap_or_else(|_| "selfhost.ishangautam7.com.np".to_string()),
        }
    }
}
