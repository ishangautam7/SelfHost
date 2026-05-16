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
const port = process.env.API_PORT || 3001;

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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function startServer() {
  try {
    // Run DB migrations before starting
    await runMigrations();
    
    const server = app.listen(port, () => {
      console.log(`Express API & Proxy running on port ${port}`);
    });
    
    // Initialize WebSocket Tunnel Manager
    initTunnelManager(server);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
