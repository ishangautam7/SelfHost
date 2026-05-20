'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { App, listApps, startApp, stopApp, deleteApp, API_BASE, listActiveAgents, ActiveAgent, getLatestAgent } from '../lib/api';
import Link from 'next/link';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [agents, setAgents] = useState<ActiveAgent[]>([]);
  const [latestAgentId, setLatestAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('ws://selfhost.ishangautam7.com.np:8080/ws/tunnel');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const router = useRouter();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadApps = useCallback(async () => {
    try {
      const data = await listApps();
      setApps(data);
    } catch {
      /* silent refresh */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const data = await listActiveAgents();
      setAgents(data);
    } catch {
      /* silent refresh */
    }
  }, []);

  const loadLatestAgent = useCallback(async () => {
    try {
      const res = await getLatestAgent();
      if (res.agent_id) {
        setLatestAgentId(res.agent_id);
      }
    } catch {
      /* silent refresh */
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadApps();
      loadAgents();
      loadLatestAgent();
      const interval = setInterval(() => {
        loadApps();
        loadAgents();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, loadApps, loadAgents, loadLatestAgent]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let wsUrl = 'ws://localhost:3001/ws/tunnel';
      if (API_BASE) {
        try {
          const url = new URL(API_BASE);
          const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${wsProtocol}//${url.host}/ws/tunnel`;
        } catch {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsUrl = `${protocol}//${window.location.hostname}/ws/tunnel`;
        }
      }
      setServerUrl(wsUrl);
    }
  }, []);

  const handleStart = async (id: string, name: string) => {
    try {
      await startApp(id);
      showToast(`Starting ${name}…`);
      loadApps();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start');
    }
  };

  const handleStop = async (id: string, name: string) => {
    try {
      await stopApp(id);
      showToast(`Stopping ${name}…`);
      loadApps();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to stop');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteApp(id);
      showToast(`${name} deleted`);
      loadApps();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const copyApiKey = () => {
    if (user?.api_key) {
      navigator.clipboard.writeText(user.api_key);
      showToast('API key copied!');
    }
  };

  const copyCliCommand = () => {
    if (user?.api_key) {
      const activeId = agents.length > 0 ? agents[0].agent_id : latestAgentId;
      const agentIdArg = activeId ? ` --agent-id ${activeId}` : '';
      const cmd = `agent connect --server ${serverUrl} --api-key ${user.api_key}${agentIdArg}`;
      navigator.clipboard.writeText(cmd);
      setCopiedCommand(true);
      showToast('CLI Command copied!');
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  if (authLoading || !user) return null;

  const runningCount = apps.filter((a) => a.status === 'running').length;

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/dashboard" className={styles.navLogo}>
            <div className={styles.logoMark}>⬡</div>
            <span className={styles.logoText}>SelfHost</span>
          </Link>
          <div className={styles.navRight}>
            <span className={styles.navUser}>@{user.username}</span>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        {/* Welcome */}
        <div className={styles.welcome}>
          <div className={styles.welcomeText}>
            <h1>
              Hello, <span>{user.username}</span>
            </h1>
            <p>Here&apos;s an overview of your deployed applications</p>
          </div>
          <Link href="/deploy" className="btn btn-gradient btn-lg">
            + Deploy New App
          </Link>
        </div>

        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </span>
            <span className={styles.statValue}>{apps.length}</span>
            <span className={styles.statLabel}>Total Apps</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </span>
            <span className={`${styles.statValue} ${styles.green}`}>{runningCount}</span>
            <span className={styles.statLabel}>Running</span>
          </div>
        </div>

        {/* API Key */}
        <div className={styles.apiSection}>
          <div className={styles.apiTop}>
            <div className={styles.apiIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
            </div>
            <div className={styles.apiInfo}>
              <h3>Agent API Key</h3>
              <p>Connect the selfhost agent on your device with this key</p>
            </div>
            <div className={styles.apiKeyWrap}>
              <code className={styles.apiKey}>
                {showApiKey ? user.api_key : '•'.repeat(32)}
              </code>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowApiKey((v) => !v)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={copyApiKey}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy Key
              </button>
            </div>
          </div>

          <div className={styles.cliContainer}>
            <div className={styles.cliTitle}>Direct Agent Connection Command</div>
            <div className={styles.commandBlock}>
              <code className={styles.commandText}>
                agent connect --server {serverUrl} --api-key {user.api_key}
                {agents.length > 0 ? ` --agent-id ${agents[0].agent_id}` : (latestAgentId ? ` --agent-id ${latestAgentId}` : '')}
              </code>
              <button className="btn btn-secondary btn-sm" onClick={copyCliCommand}>
                {copiedCommand ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight: 4}}><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: 4}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy Command
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Apps Section */}
        <div className={styles.sectionHeader}>
          <h2>Your Applications</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Auto-refreshes every 5s
          </span>
        </div>

        {loading ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading apps…</p>
          </div>
        ) : apps.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <h3>No apps deployed yet</h3>
            <p>Deploy your first app and it will appear here instantly</p>
            <Link href="/deploy" className="btn btn-gradient" style={{ marginTop: 8 }}>
              Deploy Your First App
            </Link>
          </div>
        ) : (
          <div className={styles.appGrid}>
            {apps.map((app, i) => (
              <div
                key={app.id}
                className={`card card-glow ${styles.appCard}`}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className={styles.appHeader}>
                  <h3 className={styles.appName}>{app.name}</h3>
                  <span className={`badge badge-${app.status}`}>
                    <span className="badge-dot" />
                    {app.status}
                  </span>
                </div>

                <div className={styles.appDomain}>
                  <span className={styles.domainLabel}>Public URL</span>
                  <a
                    href={`http://${app.subdomain}.selfhost.ishangautam7.com.np`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.domainLink}
                  >
                    {app.subdomain}.selfhost.ishangautam7.com.np ↗
                  </a>
                </div>

                <div className={styles.appMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Port</span>
                    <span>{app.local_port}</span>
                  </div>
                  {app.agent_id && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Agent</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{app.agent_id}</span>
                    </div>
                  )}
                </div>

                <div className={styles.appActions}>
                  {app.status === 'running' || app.status === 'starting' ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleStop(app.id, app.name)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                      Stop
                    </button>
                  ) : (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleStart(app.id, app.name)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                      Start
                    </button>
                  )}
                  <Link href={`/apps/${app.id}`} className="btn btn-secondary btn-sm">
                    Details
                  </Link>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(app.id, app.name)}
                    style={{ color: 'var(--danger)', flex: 'none' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className={styles.toast}>
          {toast}
        </div>
      )}
    </div>
  );
}
