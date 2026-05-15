use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use shared::models::*;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(url: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(url)
            .await?;
        Ok(Database { pool })
    }

    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                api_key TEXT UNIQUE NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS apps (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                name TEXT NOT NULL,
                subdomain TEXT UNIQUE NOT NULL,
                local_port INTEGER NOT NULL,
                status TEXT DEFAULT 'stopped',
                resource_cpu INTEGER DEFAULT 1,
                resource_memory INTEGER DEFAULT 512,
                created_at TEXT DEFAULT (datetime('now'))
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS tunnels (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id),
                agent_id TEXT NOT NULL,
                is_connected INTEGER DEFAULT 0,
                last_heartbeat TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            "#,
        )
        .execute(&self.pool)
        .await?;

        log::info!("Database migrations completed");
        Ok(())
    }

    // ─── Users ──────────────────────────────────────────────────────────

    pub async fn create_user(
        &self,
        id: &str,
        username: &str,
        password_hash: &str,
        api_key: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT INTO users (id, username, password_hash, api_key) VALUES (?, ?, ?, ?)")
            .bind(id)
            .bind(username)
            .bind(password_hash)
            .bind(api_key)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>, sqlx::Error> {
        let row = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.into()))
    }

    pub async fn get_user_by_id(&self, id: &str) -> Result<Option<User>, sqlx::Error> {
        let row = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.into()))
    }

    pub async fn get_user_by_api_key(&self, api_key: &str) -> Result<Option<User>, sqlx::Error> {
        let row = sqlx::query_as::<_, UserRow>("SELECT * FROM users WHERE api_key = ?")
            .bind(api_key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.into()))
    }

    // ─── Apps ───────────────────────────────────────────────────────────

    pub async fn create_app(
        &self,
        id: &str,
        user_id: &str,
        name: &str,
        subdomain: &str,
        local_port: u16,
        resource_cpu: u32,
        resource_memory: u32,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO apps (id, user_id, name, subdomain, local_port, resource_cpu, resource_memory) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(user_id)
        .bind(name)
        .bind(subdomain)
        .bind(local_port as i64)
        .bind(resource_cpu as i64)
        .bind(resource_memory as i64)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_apps_by_user(&self, user_id: &str) -> Result<Vec<App>, sqlx::Error> {
        let rows =
            sqlx::query_as::<_, AppRow>("SELECT * FROM apps WHERE user_id = ? ORDER BY created_at DESC")
                .bind(user_id)
                .fetch_all(&self.pool)
                .await?;
        Ok(rows.into_iter().map(|r| r.into()).collect())
    }

    pub async fn get_app(&self, id: &str) -> Result<Option<App>, sqlx::Error> {
        let row = sqlx::query_as::<_, AppRow>("SELECT * FROM apps WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.into()))
    }

    pub async fn get_app_by_subdomain(&self, subdomain: &str) -> Result<Option<App>, sqlx::Error> {
        let row = sqlx::query_as::<_, AppRow>("SELECT * FROM apps WHERE subdomain = ?")
            .bind(subdomain)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.into()))
    }

    pub async fn update_app(
        &self,
        id: &str,
        name: Option<&str>,
        local_port: Option<u16>,
        resource_cpu: Option<u32>,
        resource_memory: Option<u32>,
    ) -> Result<(), sqlx::Error> {
        if let Some(name) = name {
            sqlx::query("UPDATE apps SET name = ? WHERE id = ?")
                .bind(name)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(port) = local_port {
            sqlx::query("UPDATE apps SET local_port = ? WHERE id = ?")
                .bind(port as i64)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(cpu) = resource_cpu {
            sqlx::query("UPDATE apps SET resource_cpu = ? WHERE id = ?")
                .bind(cpu as i64)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(mem) = resource_memory {
            sqlx::query("UPDATE apps SET resource_memory = ? WHERE id = ?")
                .bind(mem as i64)
                .bind(id)
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }

    pub async fn update_app_status(&self, id: &str, status: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE apps SET status = ? WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_app(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM apps WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ─── Tunnels ────────────────────────────────────────────────────────

    pub async fn upsert_tunnel(
        &self,
        id: &str,
        user_id: &str,
        agent_id: &str,
        is_connected: bool,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO tunnels (id, user_id, agent_id, is_connected, last_heartbeat)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                is_connected = excluded.is_connected,
                last_heartbeat = datetime('now')
            "#,
        )
        .bind(id)
        .bind(user_id)
        .bind(agent_id)
        .bind(is_connected)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn set_tunnel_disconnected(&self, agent_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE tunnels SET is_connected = 0 WHERE agent_id = ?")
            .bind(agent_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_connected_tunnel_for_user(
        &self,
        user_id: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT agent_id FROM tunnels WHERE user_id = ? AND is_connected = 1 LIMIT 1",
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|r| r.0))
    }
}

// ─── Row types for sqlx ─────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct UserRow {
    id: String,
    username: String,
    password_hash: String,
    api_key: String,
    created_at: String,
}

impl From<UserRow> for User {
    fn from(r: UserRow) -> Self {
        User {
            id: r.id,
            username: r.username,
            password_hash: r.password_hash,
            api_key: r.api_key,
            created_at: r.created_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct AppRow {
    id: String,
    user_id: String,
    name: String,
    subdomain: String,
    local_port: i64,
    status: String,
    resource_cpu: i64,
    resource_memory: i64,
    created_at: String,
}

impl From<AppRow> for App {
    fn from(r: AppRow) -> Self {
        App {
            id: r.id,
            user_id: r.user_id,
            name: r.name,
            subdomain: r.subdomain,
            local_port: r.local_port as u16,
            status: AppStatus::from_str(&r.status),
            resource_cpu: r.resource_cpu as u32,
            resource_memory: r.resource_memory as u32,
            created_at: r.created_at,
        }
    }
}
