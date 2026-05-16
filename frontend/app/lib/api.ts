const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface UserPublic {
  id: string;
  username: string;
  api_key: string;
  created_at?: string;
}

export interface App {
  id: string;
  user_id: string;
  name: string;
  subdomain: string;
  local_port: number;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  resource_cpu: number;
  resource_memory: number;
  created_at: string;
}

export interface CreateAppRequest {
  name: string;
  subdomain: string;
  local_port: number;
  resource_cpu?: number;
  resource_memory?: number;
}

// ─── Token helpers ────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('selfhost_token');
}

function setToken(token: string) {
  localStorage.setItem('selfhost_token', token);
}

export function clearToken() {
  localStorage.removeItem('selfhost_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── Core request helper ──────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Try to parse JSON — Node.js API returns flat objects/arrays
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  if (!res.ok) {
    const errJson = json as { error?: string };
    throw new Error(errJson?.error || `HTTP ${res.status}`);
  }

  return json as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────

export async function register(username: string, password: string): Promise<UserPublic> {
  const data = await request<{ token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  // Fetch the user profile after setting the token
  return getMe();
}

export async function login(username: string, password: string): Promise<UserPublic> {
  const data = await request<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  // Fetch the user profile after setting the token
  return getMe();
}

export async function getMe(): Promise<UserPublic> {
  return request<UserPublic>('/api/auth/me');
}

// ─── Apps ─────────────────────────────────────────────────────────────

export async function listApps(): Promise<App[]> {
  return request<App[]>('/api/apps');
}

export async function getApp(id: string): Promise<App> {
  return request<App>(`/api/apps/${id}`);
}

export async function createApp(data: CreateAppRequest): Promise<App> {
  return request<App>('/api/apps', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateApp(id: string, data: Partial<CreateAppRequest>): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/apps/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteApp(id: string): Promise<void> {
  await request<{ message: string }>(`/api/apps/${id}`, { method: 'DELETE' });
}

export async function startApp(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/apps/${id}/start`, { method: 'POST' });
}

export async function stopApp(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/apps/${id}/stop`, { method: 'POST' });
}

export async function getAgentConfig(): Promise<{
  server_host: string;
  server_port: number;
  api_key: string;
  use_tls: boolean;
}> {
  return request('/api/agent/config');
}
