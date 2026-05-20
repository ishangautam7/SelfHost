mod tunnel_client;
mod app_manager;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "selfhost-agent")]
#[command(about = "SelfHost Agent — Runs on your device to host applications")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Connect to the SelfHost server and start hosting
    Connect {
        #[arg(short, long)]
        server: String,

        #[arg(short, long)]
        api_key: String,

        /// Agent ID generated automatically if not present
        #[arg(long)]
        agent_id: Option<String>,
    },
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug)]
struct LocalAgentConfig {
    agent_id: String,
}

fn get_or_create_agent_id(cli_agent_id: Option<String>) -> String {
    let config_path = Path::new("agent_config.json");

    if let Some(id) = cli_agent_id {
        let config = LocalAgentConfig {
            agent_id: id.clone(),
        };
        if let Ok(content) = serde_json::to_string_pretty(&config) {
            if let Ok(_) = fs::write(config_path, content) {
                log::info!("Saved custom agent ID from CLI arg to agent_config.json: {}", id);
            }
        }
        return id;
    }

    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(config_path) {
            if let Ok(config) = serde_json::from_str::<LocalAgentConfig>(&content) {
                log::info!("Loaded persistent agent ID from agent_config.json: {}", config.agent_id);
                return config.agent_id;
            }
        }
    }

    let new_id = format!("agent_{}", uuid::Uuid::new_v4());
    let config = LocalAgentConfig {
        agent_id: new_id.clone(),
    };
    if let Ok(content) = serde_json::to_string_pretty(&config) {
        if let Ok(_) = fs::write(config_path, content) {
            log::info!("Generated and saved new persistent agent ID to agent_config.json: {}", new_id);
        }
    }
    new_id
}

#[tokio::main]
async fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Connect {
            server,
            api_key,
            agent_id,
        } => {
            let agent_id = get_or_create_agent_id(agent_id);

            log::info!(" SelfHost Agent starting...");
            log::info!(" Server: {}", server);
            log::info!(" Agent ID: {}", agent_id);

            let app_mgr = app_manager::AppManager::new();

            loop {
                log::info!(" Connecting to server...");
                match tunnel_client::connect_and_run(&server, &api_key, &agent_id, &app_mgr)
                    .await
                {
                    Ok(()) => {
                        log::info!("Connection closed gracefully");
                    }
                    Err(e) => {
                        log::error!("Connection error: {}", e);
                    }
                }

                log::info!(" Reconnecting in 5 seconds...");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    }
}
