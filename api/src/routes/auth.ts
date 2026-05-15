import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { User } from '../models';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const apiKey = `sk_${uuidv4().replace(/-/g, '')}`;
    const id = uuidv4();

    db.prepare('INSERT INTO users (id, username, password_hash, api_key) VALUES (?, ?, ?, ?)')
      .run(id, username, passwordHash, apiKey);

    const secret = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbechangedinprod';
    const exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    const token = jwt.sign({ sub: id, username, exp }, secret);

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbechangedinprod';
    const exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
    const token = jwt.sign({ sub: user.id, username, exp }, secret);

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, (req, res) => {
  try {
    const userId = req.user!.sub;
    const user = db.prepare('SELECT id, username, api_key, created_at FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
