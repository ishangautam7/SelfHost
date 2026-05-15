import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import appsRoutes from './routes/apps';
import agentRoutes from './routes/agent';

dotenv.config({ path: '../.env' }); // Load from root .env if available

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/agent', agentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Express API running on port ${port}`);
});
