import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import appsRoutes from './routes/apps';
import agentRoutes from './routes/agent';
import { runMigrations } from './db';

dotenv.config({ path: '../.env' });

const app = express();
const port = process.env.API_PORT || 3001;

// Run DB migrations before starting
runMigrations();

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

app.listen(port, () => {
  console.log(`Express API running on port ${port}`);
});
