import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import { App } from '../models';
import { authenticate } from '../middleware/auth';
import { tunnelManager } from '../tunnel';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.sub;
    const pool = getPool();
    const result = await pool.query('SELECT * FROM apps WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user!.sub;
    const { name, subdomain, local_port, agent_id } = req.body;

    if (!name || !subdomain || !local_port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();

    const pool = getPool();

    // Fetch the logged-in user's username from db
    const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const username = userResult.rows[0].username;

    // Resolve target agent ID
    let targetAgentId = agent_id;
    if (!targetAgentId) {
      const agentResult = await pool.query(
        'SELECT agent_id FROM tunnels WHERE user_id = $1 AND is_connected = 1 ORDER BY last_heartbeat DESC LIMIT 1',
        [userId]
      );
      if (agentResult.rows.length > 0) {
        targetAgentId = agentResult.rows[0].agent_id;
      }
    }

    // Sanitize app name subdomain and build flat format: app-username (no dots, so wildcard SSL works)
    const cleanSub = subdomain.split('.')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
    const fullSubdomain = `${cleanSub}-${username}`;

    await pool.query(
      'INSERT INTO apps (id, user_id, agent_id, name, subdomain, local_port) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, userId, targetAgentId, name, fullSubdomain, local_port]
    );

    const result = await pool.query('SELECT * FROM apps WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    if (err.code === '23505') { // PostgreSQL unique violation
      return res.status(400).json({ error: 'Subdomain already in use' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.sub;
    const appId = req.params.id;

    const pool = getPool();
    const result = await pool.query('SELECT * FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
    const app = result.rows[0];
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    res.json(app);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.sub;
    const appId = req.params.id;

    const pool = getPool();
    const result = await pool.query('SELECT * FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
    const app = result.rows[0];
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    const { name, local_port } = req.body;

    if (name !== undefined) {
      await pool.query('UPDATE apps SET name = $1 WHERE id = $2', [name, appId]);
    }
    if (local_port !== undefined) {
      await pool.query('UPDATE apps SET local_port = $1 WHERE id = $2', [local_port, appId]);
    }

    res.json({ message: 'App updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.sub;
    const appId = req.params.id;

    const pool = getPool();
    const result = await pool.query('SELECT * FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
    const app = result.rows[0];
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    await pool.query('DELETE FROM apps WHERE id = $1', [appId]);
    res.json({ message: 'App deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const userId = req.user!.sub;
    const appId = req.params.id;

    const pool = getPool();
    const result = await pool.query('SELECT * FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
    const app = result.rows[0];
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Discover target agent if not bound
    let targetAgentId = app.agent_id;
    if (!targetAgentId) {
      const agentResult = await pool.query(
        'SELECT agent_id FROM tunnels WHERE user_id = $1 AND is_connected = 1 ORDER BY last_heartbeat DESC LIMIT 1',
        [userId]
      );
      if (agentResult.rows.length > 0) {
        targetAgentId = agentResult.rows[0].agent_id;
      }
    }

    if (!targetAgentId) {
      return res.status(503).json({ error: 'No active agent found. Please connect your agent device first.' });
    }

    await pool.query('UPDATE apps SET status = $1, agent_id = $2 WHERE id = $3', ['starting', targetAgentId, appId]);

    tunnelManager.sendCommand(targetAgentId, app.id, app.name, app.subdomain, app.local_port, 'start');

    res.json({ message: 'App start requested' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const userId = req.user!.sub;
    const appId = req.params.id;

    const pool = getPool();
    const result = await pool.query('SELECT * FROM apps WHERE id = $1 AND user_id = $2', [appId, userId]);
    const app = result.rows[0];
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Discover target agent if not bound
    let targetAgentId = app.agent_id;
    if (!targetAgentId) {
      const agentResult = await pool.query(
        'SELECT agent_id FROM tunnels WHERE user_id = $1 AND is_connected = 1 ORDER BY last_heartbeat DESC LIMIT 1',
        [userId]
      );
      if (agentResult.rows.length > 0) {
        targetAgentId = agentResult.rows[0].agent_id;
      }
    }

    if (!targetAgentId) {
      return res.status(503).json({ error: 'No active agent found. Please connect your agent device first.' });
    }

    await pool.query('UPDATE apps SET status = $1, agent_id = $2 WHERE id = $3', ['stopping', targetAgentId, appId]);

    tunnelManager.sendCommand(targetAgentId, app.id, app.name, app.subdomain, app.local_port, 'stop');

    res.json({ message: 'App stop requested' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;