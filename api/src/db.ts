import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function runMigrations() {
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
  } finally {
    client.release();
  }
}

export async function getUserByApiKey(apiKey: string): Promise<any> {
  const result = await pool.query('SELECT * FROM users WHERE api_key = $1', [apiKey]);
  return result.rows[0];
}

export async function upsertTunnel(agentId: string, userId: string, isConnected: boolean) {
  const connected = isConnected ? 1 : 0;
  await pool.query(
    `INSERT INTO tunnels (id, user_id, agent_id, is_connected, last_heartbeat)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT(id) DO UPDATE SET
         is_connected = $4,
         last_heartbeat = NOW()`,
    [agentId, userId, agentId, connected]
  );
}

export async function setTunnelDisconnected(agentId: string) {
  await pool.query('UPDATE tunnels SET is_connected = 0 WHERE agent_id = $1', [agentId]);
}

export async function updateAppStatus(appId: string, status: string) {
  await pool.query('UPDATE apps SET status = $1 WHERE id = $2', [status, appId]);
}

export async function getAppBySubdomain(subdomain: string): Promise<any> {
  const result = await pool.query('SELECT * FROM apps WHERE subdomain = $1', [subdomain]);
  return result.rows[0];
}

// Helper to get a client for transactions
export function getPool() {
  return pool;
}