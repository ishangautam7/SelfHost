import { Router } from 'express';
import { validate as isUuid, v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import { App } from '../models';
import { authenticate } from '../middleware/auth';
import { tunnelManager } from '../tunnel';
import { validateAppInput } from '../validation';

const router = Router();
router.use(authenticate);

async function validateLinkedApp(userId: string, appId: string | undefined, linkedAppId: unknown): Promise<string | null> {
  if (linkedAppId === undefined || linkedAppId === null) return null;
  if (typeof linkedAppId !== 'string' || !isUuid(linkedAppId)) return 'Invalid linked backend app';
  if (linkedAppId === appId) return 'An app cannot link to itself';
  const linked = await getPool().query('SELECT 1 FROM apps WHERE id = $1 AND user_id = $2', [linkedAppId, userId]);
  return linked.rowCount ? null : 'Linked backend app not found';
}

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
    const { name, subdomain, local_port, agent_id, linked_app_id } = req.body;
    const validationError = validateAppInput(name, subdomain, local_port);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    if (agent_id !== undefined && (typeof agent_id !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(agent_id))) {
      return res.status(400).json({ error: 'Invalid agent ID' });
    }
    const linkError = await validateLinkedApp(userId, undefined, linked_app_id);
    if (linkError) return res.status(400).json({ error: linkError });

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
    const fullSubdomain = `${subdomain}-${username.toLowerCase()}`;

    await pool.query(
      'INSERT INTO apps (id, user_id, agent_id, linked_app_id, name, subdomain, local_port) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, userId, targetAgentId, linked_app_id || null, name.trim(), fullSubdomain, local_port]
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

    const { name, local_port, linked_app_id } = req.body;
    const validationError = validateAppInput(name, undefined, local_port, false);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const linkError = await validateLinkedApp(userId, appId, linked_app_id);
    if (linkError) return res.status(400).json({ error: linkError });

    if (name !== undefined) {
      await pool.query('UPDATE apps SET name = $1 WHERE id = $2', [name.trim(), appId]);
    }
    if (local_port !== undefined) {
      await pool.query('UPDATE apps SET local_port = $1 WHERE id = $2', [local_port, appId]);
    }
    if (linked_app_id !== undefined) {
      await pool.query('UPDATE apps SET linked_app_id = $1 WHERE id = $2', [linked_app_id || null, appId]);
    }

    if (app.status === 'running' && app.agent_id) {
      const updated = (await pool.query('SELECT * FROM apps WHERE id = $1', [appId])).rows[0];
      tunnelManager.sendCommand(userId, app.agent_id, updated.id, updated.name, updated.subdomain, updated.local_port, 'restart');
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

    if (app.status === 'running' && app.agent_id) {
      tunnelManager.sendCommand(userId, app.agent_id, app.id, app.name, app.subdomain, app.local_port, 'stop');
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

    if (!tunnelManager.getSenderByAgentId(userId, targetAgentId)) {
      return res.status(503).json({ error: 'The selected agent is offline' });
    }
    await pool.query('UPDATE apps SET status = $1, agent_id = $2 WHERE id = $3', ['starting', targetAgentId, appId]);
    if (!tunnelManager.sendCommand(userId, targetAgentId, app.id, app.name, app.subdomain, app.local_port, 'start')) {
      await pool.query('UPDATE apps SET status = $1 WHERE id = $2', ['error', appId]);
      return res.status(503).json({ error: 'The selected agent disconnected' });
    }

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

    if (!tunnelManager.getSenderByAgentId(userId, targetAgentId)) {
      return res.status(503).json({ error: 'The selected agent is offline' });
    }
    await pool.query('UPDATE apps SET status = $1, agent_id = $2 WHERE id = $3', ['stopping', targetAgentId, appId]);
    if (!tunnelManager.sendCommand(userId, targetAgentId, app.id, app.name, app.subdomain, app.local_port, 'stop')) {
      await pool.query('UPDATE apps SET status = $1 WHERE id = $2', ['error', appId]);
      return res.status(503).json({ error: 'The selected agent disconnected' });
    }

    res.json({ message: 'App stop requested' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
