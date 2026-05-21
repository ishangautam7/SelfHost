use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Messages exchanged between the control server and the host agent
/// over the WebSocket tunnel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum TunnelMessage {
    /// Agent authenticates with the server
    Auth {
        api_key: String,
        agent_id: String,
    },

    /// Server confirms authentication
    AuthOk {
        message: String,
    },

    /// Authentication failed
    AuthError {
        message: String,
    },

    /// Server forwards an incoming HTTP request to the agent
    HttpRequest {
        request_id: String,
        subdomain: String,
        method: String,
        path: String,
        headers: HashMap<String, String>,
        body: Option<Vec<u8>>,
    },

    /// Agent sends back the HTTP response
    HttpResponse {
        request_id: String,
        status_code: u16,
        headers: HashMap<String, String>,
        body: Option<Vec<u8>>,
    },

    /// Heartbeat to keep the connection alive
    Ping,

    /// Heartbeat response
    Pong,

    /// Server sends a command to the agent (start/stop app)
    AgentCommand {
        command: AgentCommandType,
        app_id: String,
        app_name: String,
        subdomain: String,
        local_port: u16,
    },

    /// Agent reports command result
    AgentCommandResult {
        app_id: String,
        command: AgentCommandType,
        success: bool,
        message: String,
    },

    /// Agent reports current status of all apps
    StatusReport {
        apps: Vec<AppStatusEntry>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentCommandType {
    Start,
    Stop,
    Restart,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppStatusEntry {
    pub app_id: String,
    pub app_name: String,
    pub status: String,
    pub cpu_usage: f32,
    pub memory_usage_mb: u32,
    pub uptime_seconds: u64,
}
