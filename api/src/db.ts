import Database from 'better-sqlite3';
import path from 'path';

// Load the database from the project root
const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../selfhost.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency (Rust server also writes to it)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS tunnels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      agent_id TEXT NOT NULL,
      is_connected INTEGER DEFAULT 0,
      last_heartbeat TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('Database migrations completed');
}

export default db;
