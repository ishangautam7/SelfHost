"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tunnelManager = exports.TunnelManager = void 0;
exports.initTunnelManager = initTunnelManager;
const ws_1 = require("ws");
const url_1 = require("url");
const db_1 = require("./db");
class TunnelManager {
    senders = new Map(); // agentId -> WebSocket
    userAgents = new Map(); // userId -> Set<agentId>
    pendingRequests = new Map();
    wss;
    constructor(server) {
        this.wss = new ws_1.WebSocketServer({ noServer: true });
        server.on('upgrade', (request, socket, head) => {
            const parsedUrl = new url_1.URL(request.url || '', `http://${request.headers.host}`);
            if (parsedUrl.pathname === '/ws/tunnel') {
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request);
                });
            }
        });
        this.wss.on('connection', async (ws, request) => {
            const parsedUrl = new url_1.URL(request.url || '', `http://${request.headers.host}`);
            const apiKey = parsedUrl.searchParams.get('api_key');
            const agentId = parsedUrl.searchParams.get('agent_id') || `agent_${Date.now()}`;
            if (!apiKey) {
                ws.send(JSON.stringify({ type: 'AuthError', payload: { message: 'Missing api_key query parameter' } }));
                ws.close();
                return;
            }
            const user = await (0, db_1.getUserByApiKey)(apiKey);
            if (!user) {
                ws.send(JSON.stringify({ type: 'AuthError', payload: { message: 'Invalid API key' } }));
                ws.close();
                return;
            }
            const userId = user.id;
            // Register connection
            this.senders.set(agentId, ws);
            if (!this.userAgents.has(userId)) {
                this.userAgents.set(userId, new Set());
            }
            this.userAgents.get(userId).add(agentId);
            (0, db_1.upsertTunnel)(agentId, userId, true).catch(err => console.error('DB error upserting tunnel:', err));
            console.log(`Agent ${agentId} connected for user ${user.username}`);
            // Send AuthOk
            ws.send(JSON.stringify({
                type: 'AuthOk',
                payload: { message: `Connected as user ${user.username}` },
            }));
            // Heartbeat
            const pingInterval = setInterval(() => {
                if (ws.readyState === ws_1.WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'Ping' }));
                }
            }, 30000);
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    switch (msg.type) {
                        case 'Pong':
                            (0, db_1.upsertTunnel)(agentId, userId, true).catch(err => console.error('DB error updating tunnel heartbeat:', err)); // Update heartbeat
                            break;
                        case 'HttpResponse':
                            const resolve = this.pendingRequests.get(msg.payload.request_id);
                            if (resolve) {
                                resolve(msg);
                                this.pendingRequests.delete(msg.payload.request_id);
                            }
                            break;
                        case 'AgentCommandResult':
                            const status = msg.payload.success ? 'running' : 'error';
                            (0, db_1.updateAppStatus)(msg.payload.app_id, status).catch(err => console.error('DB error updating app status:', err));
                            break;
                        case 'StatusReport':
                            for (const app of msg.payload.apps) {
                                (0, db_1.updateAppStatus)(app.app_id, app.status).catch(err => console.error('DB error updating app status from report:', err));
                            }
                            break;
                    }
                }
                catch (err) {
                    console.warn('Failed to parse tunnel message:', err);
                }
            });
            ws.on('close', () => {
                clearInterval(pingInterval);
                if (this.senders.get(agentId) === ws) {
                    this.senders.delete(agentId);
                }
                const agents = this.userAgents.get(userId);
                if (agents) {
                    agents.delete(agentId);
                    if (agents.size === 0) {
                        this.userAgents.delete(userId);
                    }
                }
                (0, db_1.setTunnelDisconnected)(agentId).catch(err => console.error('DB error setting tunnel disconnected:', err));
                console.log(`Agent ${agentId} disconnected`);
            });
            ws.on('error', (err) => {
                console.error(`WebSocket error for agent ${agentId}:`, err);
            });
        });
    }
    getSender(userId) {
        const agents = this.userAgents.get(userId);
        if (agents && agents.size > 0) {
            const firstAgentId = Array.from(agents)[0];
            return this.senders.get(firstAgentId);
        }
        return undefined;
    }
    getSenderByAgentId(agentId) {
        return this.senders.get(agentId);
    }
    async sendHttpRequest(agentIdOrUserId, request) {
        const ws = this.getSenderByAgentId(agentIdOrUserId) || this.getSender(agentIdOrUserId);
        if (!ws || ws.readyState !== ws_1.WebSocket.OPEN) {
            return null;
        }
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(request.payload.request_id);
                resolve(null);
            }, 30000);
            this.pendingRequests.set(request.payload.request_id, (res) => {
                clearTimeout(timeoutId);
                resolve(res);
            });
            ws.send(JSON.stringify(request), (err) => {
                if (err) {
                    this.pendingRequests.delete(request.payload.request_id);
                    clearTimeout(timeoutId);
                    resolve(null);
                }
            });
        });
    }
    sendCommand(agentIdOrUserId, app_id, app_name, subdomain, local_port, command) {
        const ws = this.getSenderByAgentId(agentIdOrUserId) || this.getSender(agentIdOrUserId);
        if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'AgentCommand',
                payload: { command, app_id, app_name, subdomain, local_port }
            }));
        }
    }
}
exports.TunnelManager = TunnelManager;
function initTunnelManager(server) {
    exports.tunnelManager = new TunnelManager(server);
}
