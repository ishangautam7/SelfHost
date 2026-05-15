use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Tracks which apps are registered on this agent and their local ports.
/// In the future, this could manage Docker containers or processes.
#[derive(Clone)]
pub struct AppManager {
    /// Map from app_id → (app_name, local_port)
    apps: Arc<RwLock<HashMap<String, AppEntry>>>,
    /// Map from subdomain → app_id (reverse lookup for request routing)
    subdomain_map: Arc<RwLock<HashMap<String, u16>>>,
}

#[derive(Debug, Clone)]
struct AppEntry {
    name: String,
    local_port: u16,
}

impl AppManager {
    pub fn new() -> Self {
        AppManager {
            apps: Arc::new(RwLock::new(HashMap::new())),
            subdomain_map: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn register_app(&self, app_id: &str, name: &str, local_port: u16) {
        let mut apps = self.apps.write().unwrap();
        apps.insert(
            app_id.to_string(),
            AppEntry {
                name: name.to_string(),
                local_port,
            },
        );

        // Use the app name (lowercase, sanitized) as subdomain key
        let subdomain = name.to_lowercase().replace(' ', "-");
        let mut smap = self.subdomain_map.write().unwrap();
        smap.insert(subdomain, local_port);

        log::info!(
            "📦 Registered app: {} (id: {}) on port {}",
            name,
            app_id,
            local_port
        );
    }

    pub fn unregister_app(&self, app_id: &str) {
        let mut apps = self.apps.write().unwrap();
        if let Some(entry) = apps.remove(app_id) {
            let subdomain = entry.name.to_lowercase().replace(' ', "-");
            let mut smap = self.subdomain_map.write().unwrap();
            smap.remove(&subdomain);
            log::info!("📦 Unregistered app: {} (id: {})", entry.name, app_id);
        }
    }

    pub fn get_port_for_subdomain(&self, subdomain: &str) -> Option<u16> {
        let smap = self.subdomain_map.read().unwrap();
        smap.get(subdomain).copied()
    }

    pub fn list_apps(&self) -> Vec<(String, String, u16)> {
        let apps = self.apps.read().unwrap();
        apps.iter()
            .map(|(id, entry)| (id.clone(), entry.name.clone(), entry.local_port))
            .collect()
    }
}
