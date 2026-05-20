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
exports.getPool = getPool;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
async function runMigrations() {
    const client = await pool.connect();
    try {
        // Create tables if they don't exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        api_key TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS apps (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        agent_id TEXT,
        name TEXT NOT NULL,
        subdomain TEXT UNIQUE NOT NULL,
        local_port INTEGER NOT NULL,
        status TEXT DEFAULT 'stopped',
        resource_cpu INTEGER DEFAULT 1,
        resource_memory INTEGER DEFAULT 512,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        // Ensure agent_id column exists on existing databases
        await client.query(`
      ALTER TABLE apps ADD COLUMN IF NOT EXISTS agent_id TEXT;
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS tunnels (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        agent_id TEXT NOT NULL,
        is_connected INTEGER DEFAULT 0,
        last_heartbeat TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('Database migrations completed');
    }
    finally {
        client.release();
    }
}
async function getUserByApiKey(apiKey) {
    const result = await pool.query('SELECT * FROM users WHERE api_key = $1', [apiKey]);
    return result.rows[0];
}
async function upsertTunnel(agentId, userId, isConnected) {
    const connected = isConnected ? 1 : 0;
    await pool.query(`INSERT INTO tunnels (id, user_id, agent_id, is_connected, last_heartbeat)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT(id) DO UPDATE SET
         is_connected = $4,
         last_heartbeat = NOW()`, [agentId, userId, agentId, connected]);
}
async function setTunnelDisconnected(agentId) {
    await pool.query('UPDATE tunnels SET is_connected = 0 WHERE agent_id = $1', [agentId]);
}
async function updateAppStatus(appId, status) {
    await pool.query('UPDATE apps SET status = $1 WHERE id = $2', [status, appId]);
}
async function getAppBySubdomain(subdomain) {
    const result = await pool.query('SELECT * FROM apps WHERE subdomain = $1', [subdomain]);
    return result.rows[0];
}
// Helper to get a client for transactions
function getPool() {
    return pool;
}
