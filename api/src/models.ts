export interface User {
  id: string;
  username: string;
  password_hash: string;
  api_key: string;
  created_at: string;
}

export interface App {
  id: string;
  user_id: string;
  name: string;
  subdomain: string;
  local_port: number;
  status: string;
  created_at: string;
}

export interface Tunnel {
  id: string;
  user_id: string;
  agent_id: string;
  is_connected: boolean;
  last_heartbeat: string;
  created_at: string;
}
