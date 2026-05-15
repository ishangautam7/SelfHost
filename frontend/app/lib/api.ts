const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface UserPublic {
  id: string;
  username: string;
  api_key: string;
}

export interface App {
  id: string;
  user_id: string;
  name: string;
  subdomain: string;
  local_port: number;
  status: 'running' | 'stopped' | 'deploying' | 'error';
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await res.json();

  if (!json.success || !json.data) {
    throw new Error(json.error || 'Request failed');
  }

  return json.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────

export async function register(username: string, password: string): Promise<UserPublic> {
  const data = await request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data.user;
}

export async function login(username: string, password: string): Promise<UserPublic> {
  const data = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data.user;
}

export async function getMe(): Promise<UserPublic> {
  return request<UserPublic>('/api/me');
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

export async function updateApp(id: string, data: Partial<CreateAppRequest>): Promise<App> {
  return request<App>(`/api/apps/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteApp(id: string): Promise<void> {
  await request(`/api/apps/${id}`, { method: 'DELETE' });
}

export async function startApp(id: string): Promise<{ message: string; status: string }> {
  return request(`/api/apps/${id}/start`, { method: 'POST' });
}

export async function stopApp(id: string): Promise<{ message: string; status: string }> {
  return request(`/api/apps/${id}/stop`, { method: 'POST' });
}

export async function getAgentConfig(): Promise<{ server_url: string; api_key: string; agent_id: string }> {
  return request('/api/agent/config');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
