use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─── User ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub api_key: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserPublic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPublic {
    pub id: String,
    pub username: String,
    pub api_key: String,
}

// ─── App ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AppStatus {
    Running,
    Stopped,
    Deploying,
    Error,
}

impl AppStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            AppStatus::Running => "running",
            AppStatus::Stopped => "stopped",
            AppStatus::Deploying => "deploying",
            AppStatus::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "running" => AppStatus::Running,
            "deploying" => AppStatus::Deploying,
            "error" => AppStatus::Error,
            _ => AppStatus::Stopped,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct App {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub subdomain: String,
    pub local_port: u16,
    pub status: AppStatus,
    pub resource_cpu: u32,
    pub resource_memory: u32,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppRequest {
    pub name: String,
    pub subdomain: String,
    pub local_port: u16,
    pub resource_cpu: Option<u32>,
    pub resource_memory: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppRequest {
    pub name: Option<String>,
    pub local_port: Option<u16>,
    pub resource_cpu: Option<u32>,
    pub resource_memory: Option<u32>,
}

// ─── Agent / Tunnel ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub agent_id: String,
    pub user_id: String,
    pub is_connected: bool,
    pub last_heartbeat: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AgentConfig {
    pub server_url: String,
    pub api_key: String,
    pub agent_id: String,
}

// ─── Generic API Responses ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        ApiResponse {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        ApiResponse {
            success: false,
            data: None,
            error: Some(msg.into()),
        }
    }
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}
