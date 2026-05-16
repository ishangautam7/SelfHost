import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import { App } from '../models';
import { authenticate } from '../middleware/auth';

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
    const { name, subdomain, local_port, resource_cpu, resource_memory } = req.body;

    if (!name || !subdomain || !local_port) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cpu = resource_cpu || 1;
    const memory = resource_memory || 512;
    const id = uuidv4();

    const pool = getPool();
    await pool.query(
      'INSERT INTO apps (id, user_id, name, subdomain, local_port, resource_cpu, resource_memory) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, userId, name, subdomain, local_port, cpu, memory]
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

    const { name, local_port, resource_cpu, resource_memory } = req.body;

    if (name !== undefined) {
      await pool.query('UPDATE apps SET name = $1 WHERE id = $2', [name, appId]);
    }
    if (local_port !== undefined) {
      await pool.query('UPDATE apps SET local_port = $1 WHERE id = $2', [local_port, appId]);
    }
    if (resource_cpu !== undefined) {
      await pool.query('UPDATE apps SET resource_cpu = $1 WHERE id = $2', [resource_cpu, appId]);
    }
    if (resource_memory !== undefined) {
      await pool.query('UPDATE apps SET resource_memory = $1 WHERE id = $2', [resource_memory, appId]);
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

    await pool.query('UPDATE apps SET status = $1 WHERE id = $2', ['starting', appId]);
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

    await pool.query('UPDATE apps SET status = $1 WHERE id = $2', ['stopping', appId]);
    res.json({ message: 'App stop requested' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;