import { Router } from 'express';
import { getPool } from '../db';
import { User } from '../models';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/config', async (req, res) => {
  try {
    const userId = req.user!.sub;

    const pool = getPool();
    const result = await pool.query('SELECT api_key FROM users WHERE id = $1', [userId]);
    const user = result.rows[0] as Pick<User, 'api_key'> | undefined;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const host = process.env.SERVER_HOST || '127.0.0.1';
    const port = parseInt(process.env.SERVER_PORT || '8080', 10);
    const useTls = process.env.USE_TLS === 'true';

    res.json({
      server_host: host,
      server_port: port,
      api_key: user.api_key,
      use_tls: useTls
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;