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
        /// Server URL (e.g., ws://your-server.com:8080/ws/tunnel)
        #[arg(short, long)]
        server: String,

        /// Your API key (from the dashboard)
        #[arg(short, long)]
        api_key: String,

        /// Agent ID (auto-generated if not provided)
        #[arg(long)]
        agent_id: Option<String>,
    },
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
            let agent_id =
                agent_id.unwrap_or_else(|| format!("agent_{}", uuid::Uuid::new_v4()));

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
