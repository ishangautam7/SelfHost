"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
exports.getUserByApiKey = getUserByApiKey;
exports.upsertTunnel = upsertTunnel;
exports.setTunnelDisconnected = setTunnelDisconnected;
exports.updateAppStatus = updateAppStatus;
exports.getAppBySubdomain = getAppBySubdomain;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
// Load the database from the project root
const dbPath = process.env.DB_PATH || path_1.default.resolve(__dirname, '../../selfhost.db');
const db = new better_sqlite3_1.default(dbPath);
// Enable WAL mode for better concurrency (Rust server also writes to it)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
function runMigrations() {
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
function getUserByApiKey(apiKey) {
    return db.prepare('SELECT * FROM users WHERE api_key = ?').get(apiKey);
}
function upsertTunnel(agentId, userId, isConnected) {
    const connected = isConnected ? 1 : 0;
    db.prepare(`
    INSERT INTO tunnels (id, user_id, agent_id, is_connected, last_heartbeat)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
        is_connected = excluded.is_connected,
        last_heartbeat = datetime('now')
  `).run(agentId, userId, agentId, connected);
}
function setTunnelDisconnected(agentId) {
    db.prepare('UPDATE tunnels SET is_connected = 0 WHERE agent_id = ?').run(agentId);
}
function updateAppStatus(appId, status) {
    db.prepare('UPDATE apps SET status = ? WHERE id = ?').run(status, appId);
}
function getAppBySubdomain(subdomain) {
    return db.prepare('SELECT * FROM apps WHERE subdomain = ?').get(subdomain);
}
exports.default = db;
