import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import appsRoutes from './routes/apps';
import agentRoutes from './routes/agent';
import { runMigrations } from './db';
import { proxyMiddleware } from './proxy';
import { initTunnelManager } from './tunnel';

dotenv.config({ path: '../.env' });

const app = express();
const port = parseInt(process.env.PORT || '10000', 10);

console.log(`PORT env: ${process.env.PORT}, using port: ${port}`);

// 1. Proxy Middleware (Must come BEFORE body parsers like express.json)
// We need raw bodies for the proxy to forward requests transparently.
app.use(proxyMiddleware);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/agent', agentRoutes);

// Health check
app.get('/', (req, res) => res.send('OK'));
app.get('/health', (req, res) => res.send('OK'));
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Temporary debug endpoint
app.get('/api/debug/subdomain/:sub', async (req, res) => {
  const { getPool } = await import('./db');
  const pool = getPool();
  try {
    const result = await pool.query('SELECT id, name, subdomain, status, agent_id FROM apps WHERE subdomain = $1', [req.params.sub]);
    const allApps = await pool.query('SELECT id, name, subdomain FROM apps');
    res.json({
      query_subdomain: req.params.sub,
      found: result.rows,
      all_apps: allApps.rows,
      base_domain: process.env.BASE_DOMAIN || 'selfhost.ishangautam7.com.np',
      host_header: req.headers.host
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function startServer() {
  try {
    // Run DB migrations before starting
    await runMigrations();
    
    const host = '0.0.0.0';
    const server = app.listen(port as number, host, () => {
      console.log(`Express API & Proxy running on ${host}:${port}`);
    });
    
    // Initialize WebSocket Tunnel Manager
    initTunnelManager(server);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
