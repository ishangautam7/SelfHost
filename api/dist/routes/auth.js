"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const existingUser = db_1.default.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const apiKey = `sk_${(0, uuid_1.v4)().replace(/-/g, '')}`;
        const id = (0, uuid_1.v4)();
        db_1.default.prepare('INSERT INTO users (id, username, password_hash, api_key) VALUES (?, ?, ?, ?)')
            .run(id, username, passwordHash, apiKey);
        const secret = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbechangedinprod';
        const exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
        const token = jsonwebtoken_1.default.sign({ sub: id, username, exp }, secret);
        res.json({ token });
    }
    catch (err) {
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
        const user = db_1.default.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const secret = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbechangedinprod';
        const exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
        const token = jsonwebtoken_1.default.sign({ sub: user.id, username, exp }, secret);
        res.json({ token });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/me', auth_1.authenticate, (req, res) => {
    try {
        const userId = req.user.sub;
        const user = db_1.default.prepare('SELECT id, username, api_key, created_at FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
