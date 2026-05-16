"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/config', (req, res) => {
    try {
        const userId = req.user.sub;
        // We need the user's API key and base domain to give to the agent
        const user = db_1.default.prepare('SELECT api_key FROM users WHERE id = ?').get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Usually the server host and port should come from env or config
        // In Rust it was state.config.host, etc.
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
exports.default = router;
