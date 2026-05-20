import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { URL } from 'url';
import { getUserByApiKey, upsertTunnel, setTunnelDisconnected, updateAppStatus } from './db';

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
        local_port: number;
      };
    }
  | {
      type: 'AgentCommandResult';
      payload: { app_id: string; success: boolean; message: string };
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
  private userAgents: Map<string, Set<string>> = new Map(); // userId -> Set<agentId>
  private pendingRequests: Map<string, (res: TunnelMessage & { type: 'HttpResponse' }) => void> = new Map();
  private wss: WebSocketServer;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

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
      const apiKey = parsedUrl.searchParams.get('api_key');
      const agentId = parsedUrl.searchParams.get('agent_id') || `agent_${Date.now()}`;

      if (!apiKey) {
        ws.send(JSON.stringify({ type: 'AuthError', payload: { message: 'Missing api_key query parameter' } }));
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
      this.senders.set(agentId, ws);
      if (!this.userAgents.has(userId)) {
        this.userAgents.set(userId, new Set());
      }
      this.userAgents.get(userId)!.add(agentId);
      upsertTunnel(agentId, userId, true).catch(err => console.error('DB error upserting tunnel:', err));

      console.log(`Agent ${agentId} connected for user ${user.username}`);

      // Send AuthOk
      ws.send(
        JSON.stringify({
          type: 'AuthOk',
          payload: { message: `Connected as user ${user.username}` },
        })
      );

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
              const status = msg.payload.success ? 'running' : 'error';
              updateAppStatus(msg.payload.app_id, status).catch(err => console.error('DB error updating app status:', err));
              break;
            case 'StatusReport':
              for (const app of msg.payload.apps) {
                updateAppStatus(app.app_id, app.status).catch(err => console.error('DB error updating app status from report:', err));
              }
              break;
          }
        } catch (err) {
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
        setTunnelDisconnected(agentId).catch(err => console.error('DB error setting tunnel disconnected:', err));
        console.log(`Agent ${agentId} disconnected`);
      });

      ws.on('error', (err) => {
        console.error(`WebSocket error for agent ${agentId}:`, err);
      });
    });
  }

  public getSender(userId: string): WebSocket | undefined {
    const agents = this.userAgents.get(userId);
    if (agents && agents.size > 0) {
      const firstAgentId = Array.from(agents)[0];
      return this.senders.get(firstAgentId);
    }
    return undefined;
  }

  public getSenderByAgentId(agentId: string): WebSocket | undefined {
    return this.senders.get(agentId);
  }

  public async sendHttpRequest(agentIdOrUserId: string, request: TunnelMessage & { type: 'HttpRequest' }): Promise<(TunnelMessage & { type: 'HttpResponse' }) | null> {
    const ws = this.getSenderByAgentId(agentIdOrUserId) || this.getSender(agentIdOrUserId);
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

  public sendCommand(agentIdOrUserId: string, app_id: string, app_name: string, local_port: number, command: AgentCommandType) {
    const ws = this.getSenderByAgentId(agentIdOrUserId) || this.getSender(agentIdOrUserId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'AgentCommand',
        payload: { command, app_id, app_name, local_port }
      }));
    }
  }
}

// Global instance to be initialized on server start
export let tunnelManager: TunnelManager;

export function initTunnelManager(server: Server) {
  tunnelManager = new TunnelManager(server);
}
