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
#[allow(dead_code)]
struct AppEntry {
    name: String,
    subdomain: String,
    local_port: u16,
}

impl AppManager {
    pub fn new() -> Self {
        AppManager {
            apps: Arc::new(RwLock::new(HashMap::new())),
            subdomain_map: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn register_app(&self, app_id: &str, name: &str, subdomain: &str, local_port: u16) {
        let mut apps = self.apps.write().unwrap();
        apps.insert(
            app_id.to_string(),
            AppEntry {
                name: name.to_string(),
                subdomain: subdomain.to_string(),
                local_port,
            },
        );

        // Use the actual subdomain from the database for routing
        let mut smap = self.subdomain_map.write().unwrap();
        smap.insert(subdomain.to_string(), local_port);

        log::info!(
            "Registered app: {} (id: {}, subdomain: {}) on port {}",
            name,
            app_id,
            subdomain,
            local_port
        );
    }

    pub fn unregister_app(&self, app_id: &str) {
        let mut apps = self.apps.write().unwrap();
        if let Some(entry) = apps.remove(app_id) {
            let mut smap = self.subdomain_map.write().unwrap();
            smap.remove(&entry.subdomain);
            log::info!("Unregistered app: {} (id: {})", entry.name, app_id);
        }
    }

    pub fn get_port_for_subdomain(&self, subdomain: &str) -> Option<u16> {
        let smap = self.subdomain_map.read().unwrap();
        smap.get(subdomain).copied()
    }

    #[allow(dead_code)]
    pub fn list_apps(&self) -> Vec<(String, String, u16)> {
        let apps = self.apps.read().unwrap();
        apps.iter()
            .map(|(id, entry)| (id.clone(), entry.name.clone(), entry.local_port))
            .collect()
    }
}
