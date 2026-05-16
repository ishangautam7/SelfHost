"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', (req, res) => {
    try {
        const userId = req.user.sub;
        const apps = db_1.default.prepare('SELECT * FROM apps WHERE user_id = ? ORDER BY created_at DESC').all(userId);
        res.json(apps);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', (req, res) => {
    try {
        const userId = req.user.sub;
        const { name, subdomain, local_port, resource_cpu, resource_memory } = req.body;
        if (!name || !subdomain || !local_port) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const cpu = resource_cpu || 1;
        const memory = resource_memory || 512;
        const id = (0, uuid_1.v4)();
        db_1.default.prepare('INSERT INTO apps (id, user_id, name, subdomain, local_port, resource_cpu, resource_memory) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, userId, name, subdomain, local_port, cpu, memory);
        const newApp = db_1.default.prepare('SELECT * FROM apps WHERE id = ?').get(id);
        res.json(newApp);
    }
    catch (err) {
        console.error(err);
        if (err.message.includes('UNIQUE constraint failed: apps.subdomain')) {
            return res.status(400).json({ error: 'Subdomain already in use' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id', (req, res) => {
    try {
        const userId = req.user.sub;
        const appId = req.params.id;
        const app = db_1.default.prepare('SELECT * FROM apps WHERE id = ? AND user_id = ?').get(appId, userId);
        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }
        res.json(app);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', (req, res) => {
    try {
        const userId = req.user.sub;
        const appId = req.params.id;
        const app = db_1.default.prepare('SELECT * FROM apps WHERE id = ? AND user_id = ?').get(appId, userId);
        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }
        const { name, local_port, resource_cpu, resource_memory } = req.body;
        if (name !== undefined) {
            db_1.default.prepare('UPDATE apps SET name = ? WHERE id = ?').run(name, appId);
        }
        if (local_port !== undefined) {
            db_1.default.prepare('UPDATE apps SET local_port = ? WHERE id = ?').run(local_port, appId);
        }
        if (resource_cpu !== undefined) {
            db_1.default.prepare('UPDATE apps SET resource_cpu = ? WHERE id = ?').run(resource_cpu, appId);
        }
        if (resource_memory !== undefined) {
            db_1.default.prepare('UPDATE apps SET resource_memory = ? WHERE id = ?').run(resource_memory, appId);
        }
        res.json({ message: 'App updated successfully' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', (req, res) => {
    try {
        const userId = req.user.sub;
        const appId = req.params.id;
        const app = db_1.default.prepare('SELECT * FROM apps WHERE id = ? AND user_id = ?').get(appId, userId);
        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }
        db_1.default.prepare('DELETE FROM apps WHERE id = ?').run(appId);
        res.json({ message: 'App deleted successfully' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// App lifecycle actions
router.post('/:id/start', (req, res) => {
    try {
        const userId = req.user.sub;
        const appId = req.params.id;
        const app = db_1.default.prepare('SELECT * FROM apps WHERE id = ? AND user_id = ?').get(appId, userId);
        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }
        // Agent handles actual start, we just update status to 'starting'
        db_1.default.prepare('UPDATE apps SET status = ? WHERE id = ?').run('starting', appId);
        res.json({ message: 'App start requested' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/stop', (req, res) => {
    try {
        const userId = req.user.sub;
        const appId = req.params.id;
        const app = db_1.default.prepare('SELECT * FROM apps WHERE id = ? AND user_id = ?').get(appId, userId);
        if (!app) {
            return res.status(404).json({ error: 'App not found' });
        }
        // Agent handles actual stop, we update status to 'stopping'
        db_1.default.prepare('UPDATE apps SET status = ? WHERE id = ?').run('stopping', appId);
        res.json({ message: 'App stop requested' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
