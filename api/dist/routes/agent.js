"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/config', async (req, res) => {
    try {
        const userId = req.user.sub;
        const pool = (0, db_1.getPool)();
        const result = await pool.query('SELECT api_key FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];
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
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/active', async (req, res) => {
    try {
        const userId = req.user.sub;
        const pool = (0, db_1.getPool)();
        const result = await pool.query('SELECT agent_id, last_heartbeat FROM tunnels WHERE user_id = $1 AND is_connected = 1 ORDER BY last_heartbeat DESC', [userId]);
        res.json(result.rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
