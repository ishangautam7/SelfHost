"use strict";
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
