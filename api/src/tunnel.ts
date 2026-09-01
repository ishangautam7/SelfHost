import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { URL } from 'url';
import { getUserByApiKey, upsertTunnel, setTunnelDisconnected, updateAppStatus, getAppsForAgent, getPool } from './db';

export type AgentCommandType = 'start' | 'stop' | 'restart';

export type TunnelMessage =
  | { type: 'Auth'; payload: { api_key: string; agent_id: string } }
  | { type: 'AuthOk'; payload: { message: string } }
  | { type: 'AuthError'; payload: { message: string } }
  | {
      type: 'HttpRequest';
      payload: {
        request_id: string;
        subdomain: string;
        method: string;
        path: string;
        headers: Record<string, string>;
        body?: number[];
      };
    }
  | {
      type: 'HttpResponse';
      payload: {
        request_id: string;
        status_code: number;
        headers: Record<string, string>;
        body?: number[];
      };
    }
  | { type: 'Ping' }
  | { type: 'Pong' }
  | {
      type: 'AgentCommand';
      payload: {
        command: AgentCommandType;
        app_id: string;
        app_name: string;
        subdomain: string;
        local_port: number;
      };
    }
  | {
      type: 'AgentCommandResult';
      payload: { app_id: string; command: string; success: boolean; message: string };
    }
  | {
      type: 'StatusReport';
      payload: {
        apps: {
          app_id: string;
          app_name: string;
          status: string;
          cpu_usage: number;
          memory_usage_mb: number;
          uptime_seconds: number;
        }[];
      };
    };

export class TunnelManager {
  private senders: Map<string, WebSocket> = new Map(); // agentId -> WebSocket
  private pendingRequests: Map<string, (res: TunnelMessage & { type: 'HttpResponse' }) => void> = new Map();
  private wss: WebSocketServer;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 12 * 1024 * 1024 });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      const parsedUrl = new URL(request.url || '', `http://${request.headers.host}`);
      if (parsedUrl.pathname === '/ws/tunnel') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      const parsedUrl = new URL(request.url || '', `http://${request.headers.host}`);
      const authHeader = request.headers.authorization;
      const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const agentId = parsedUrl.searchParams.get('agent_id') || `agent_${Date.now()}`;

      if (!apiKey) {
        ws.send(JSON.stringify({ type: 'AuthError', payload: { message: 'Missing Authorization header' } }));
        ws.close();
        return;
      }
      if (!/^[a-zA-Z0-9._-]{1,128}$/.test(agentId)) {
        ws.send(JSON.stringify({ type: 'AuthError', payload: { message: 'Invalid agent ID' } }));
        ws.close();
        return;
      }

      const user = await getUserByApiKey(apiKey);
      if (!user) {
        ws.send(JSON.stringify({ type: 'AuthError', payload: { message: 'Invalid API key' } }));
        ws.close();
        return;
      }

      const userId = user.id;

      // Register connection
      const senderKey = `${userId}:${agentId}`;
      this.senders.set(senderKey, ws);
      upsertTunnel(agentId, userId, true).catch(err => console.error('DB error upserting tunnel:', err));

      console.log(`Agent ${agentId} connected for user ${user.username}`);

      // Send AuthOk
      ws.send(
        JSON.stringify({
          type: 'AuthOk',
          payload: { message: `Connected as user ${user.username}` },
        })
      );

      // Sync active apps to the newly connected agent
      try {
        const apps = await getAppsForAgent(agentId, userId);
        for (const app of apps) {
          ws.send(JSON.stringify({
            type: 'AgentCommand',
            payload: {
              command: 'start',
              app_id: app.id,
              app_name: app.name,
              subdomain: app.subdomain,
              local_port: app.local_port
            }
          }));
        }
      } catch (err) {
        console.error('Failed to sync apps to agent:', err);
      }

      // Heartbeat
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'Ping' }));
        }
      }, 30000);

      ws.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data.toString()) as TunnelMessage;
          switch (msg.type) {
            case 'Pong':
              upsertTunnel(agentId, userId, true).catch(err => console.error('DB error updating tunnel heartbeat:', err)); // Update heartbeat
              break;
            case 'HttpResponse':
              const resolve = this.pendingRequests.get(msg.payload.request_id);
              if (resolve) {
                resolve(msg as TunnelMessage & { type: 'HttpResponse' });
                this.pendingRequests.delete(msg.payload.request_id);
              }
              break;
            case 'AgentCommandResult':
              if (msg.payload.success) {
                // If agent sends command type, use it directly
                if (msg.payload.command) {
                  const resultStatus = msg.payload.command === 'stop' ? 'stopped' : 'running';
                  updateAppStatus(msg.payload.app_id, resultStatus, userId).catch(err => console.error('DB error updating app status:', err));
                } else {
                  // Fallback: check current DB status to infer intent
                  const pool = getPool();
                  pool.query('SELECT status FROM apps WHERE id = $1', [msg.payload.app_id])
                    .then(appResult => {
                      const currentStatus = appResult.rows[0]?.status;
                      const resultStatus = (currentStatus === 'stopping') ? 'stopped' : 'running';
                      updateAppStatus(msg.payload.app_id, resultStatus, userId).catch(err => console.error('DB error updating app status:', err));
                    })
                    .catch(dbErr => {
                      console.error('DB error looking up app status for fallback:', dbErr);
                      updateAppStatus(msg.payload.app_id, 'running', userId).catch(err => console.error('DB error:', err));
                    });
                }
              } else {
                updateAppStatus(msg.payload.app_id, 'error', userId).catch(err => console.error('DB error updating app status:', err));
              }
              break;
            case 'StatusReport':
              for (const app of msg.payload.apps) {
                updateAppStatus(app.app_id, app.status, userId).catch(err => console.error('DB error updating app status from report:', err));
              }
              break;
          }
        } catch (err) {
          console.warn('Failed to parse tunnel message:', err);
        }
      });

      ws.on('close', () => {
        clearInterval(pingInterval);
        if (this.senders.get(senderKey) === ws) {
          this.senders.delete(senderKey);
          setTunnelDisconnected(agentId, userId).catch(err => console.error('DB error setting tunnel disconnected:', err));
        }
        console.log(`Agent ${agentId} disconnected`);
      });

      ws.on('error', (err) => {
        console.error(`WebSocket error for agent ${agentId}:`, err);
      });
    });
  }

  public getSenderByAgentId(userId: string, agentId: string): WebSocket | undefined {
    return this.senders.get(`${userId}:${agentId}`);
  }

  public async sendHttpRequest(userId: string, agentId: string, request: TunnelMessage & { type: 'HttpRequest' }): Promise<(TunnelMessage & { type: 'HttpResponse' }) | null> {
    const ws = this.getSenderByAgentId(userId, agentId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
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

  public sendCommand(userId: string, agentId: string, app_id: string, app_name: string, subdomain: string, local_port: number, command: AgentCommandType): boolean {
    const ws = this.getSenderByAgentId(userId, agentId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'AgentCommand',
        payload: { command, app_id, app_name, subdomain, local_port }
      }));
      return true;
    }
    return false;
  }
}

// Global instance to be initialized on server start
export let tunnelManager: TunnelManager;

export function initTunnelManager(server: Server) {
  tunnelManager = new TunnelManager(server);
}
