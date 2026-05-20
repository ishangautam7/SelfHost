"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const apps_1 = __importDefault(require("./routes/apps"));
const agent_1 = __importDefault(require("./routes/agent"));
const db_1 = require("./db");
const proxy_1 = require("./proxy");
const tunnel_1 = require("./tunnel");
dotenv_1.default.config({ path: '../.env' });
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT || '10000', 10);
console.log(`PORT env: ${process.env.PORT}, using port: ${port}`);
// 1. Proxy Middleware (Must come BEFORE body parsers like express.json)
// We need raw bodies for the proxy to forward requests transparently.
app.use(proxy_1.proxyMiddleware);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/apps', apps_1.default);
app.use('/api/agent', agent_1.default);
// Health check
app.get('/', (req, res) => res.send('OK'));
app.get('/health', (req, res) => res.send('OK'));
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Temporary debug endpoint
app.get('/api/debug/subdomain/:sub', async (req, res) => {
    const { getPool } = await Promise.resolve().then(() => __importStar(require('./db')));
    const pool = getPool();
    try {
        const result = await pool.query('SELECT id, name, subdomain, status, agent_id FROM apps WHERE subdomain = $1', [req.params.sub]);
        const allApps = await pool.query('SELECT id, name, subdomain FROM apps');
        res.json({
            query_subdomain: req.params.sub,
            found: result.rows,
            all_apps: allApps.rows,
            base_domain: process.env.BASE_DOMAIN || 'selfhost.ishangautam7.com.np',
            host_header: req.headers.host
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
async function startServer() {
    try {
        // Run DB migrations before starting
        await (0, db_1.runMigrations)();
        const host = '0.0.0.0';
        const server = app.listen(port, host, () => {
            console.log(`Express API & Proxy running on ${host}:${port}`);
        });
        // Initialize WebSocket Tunnel Manager
        (0, tunnel_1.initTunnelManager)(server);
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
