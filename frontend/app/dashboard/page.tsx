'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { App, listApps, startApp, stopApp, deleteApp } from '../lib/api';
import Link from 'next/link';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadApps();
      const interval = setInterval(loadApps, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadApps = async () => {
    try {
      const data = await listApps();
      setApps(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await startApp(id);
      loadApps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopApp(id);
      loadApps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete app "${name}"? This cannot be undone.`)) return;
    try {
      await deleteApp(id);
      loadApps();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (authLoading || !user) return null;

  const runningCount = apps.filter(a => a.status === 'running').length;
  const totalCpu = apps.reduce((sum, a) => sum + a.resource_cpu, 0);
  const totalMem = apps.reduce((sum, a) => sum + a.resource_memory, 0);

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/dashboard" className={styles.navLogo}>
            <span className={styles.logoIcon}>⬡</span>
            <span>SelfHost</span>
          </Link>
          <div className={styles.navRight}>
            <span className={styles.navUser}>@{user.username}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        {/* Stats */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{apps.length}</span>
            <span className={styles.statLabel}>Total Apps</span>
          </div>
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.green}`}>{runningCount}</span>
            <span className={styles.statLabel}>Running</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totalCpu}</span>
            <span className={styles.statLabel}>CPU Cores</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totalMem}</span>
            <span className={styles.statLabel}>Memory (MB)</span>
          </div>
        </div>

        {/* API Key Section */}
        <div className={styles.apiSection}>
          <div className={styles.apiInfo}>
            <h3>Agent API Key</h3>
            <p>Use this to connect the agent on your device</p>
          </div>
          <div className={styles.apiKeyWrap}>
            <code className={styles.apiKey}>
              {showApiKey ? user.api_key : '••••••••••••••••••••••••'}
            </code>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? 'Hide' : 'Show'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(user.api_key)}>
              Copy
            </button>
          </div>
        </div>

        {/* Header */}
        <div className={styles.sectionHeader}>
          <h2>Your Applications</h2>
          <Link href="/deploy" className="btn btn-primary">
            + Deploy New App
          </Link>
        </div>

        {/* App Grid */}
        {loading ? (
          <div className={styles.empty}>Loading apps...</div>
        ) : apps.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}></div>
            <h3>No apps deployed yet</h3>
            <p>Deploy your first app and it will appear here</p>
            <Link href="/deploy" className="btn btn-primary" style={{ marginTop: 16 }}>
              Deploy Your First App
            </Link>
          </div>
        ) : (
          <div className={styles.appGrid}>
            {apps.map((app, i) => (
              <div key={app.id} className={`card ${styles.appCard}`} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={styles.appHeader}>
                  <h3 className={styles.appName}>{app.name}</h3>
                  <span className={`badge badge-${app.status}`}>
                    <span className="badge-dot" />
                    {app.status}
                  </span>
                </div>
                <div className={styles.appDomain}>
                  <span className={styles.domainLabel}>Domain</span>
                  <a
                    href={`http://${app.subdomain}.selfhost.ishangautam7.com.np`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.domainLink}
                  >
                    {app.subdomain}.selfhost.ishangautam7.com.np
                  </a>
                </div>
                <div className={styles.appMeta}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Port</span>
                    <span>{app.local_port}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>CPU</span>
                    <span>{app.resource_cpu} core{app.resource_cpu > 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>RAM</span>
                    <span>{app.resource_memory} MB</span>
                  </div>
                </div>
                <div className={styles.appActions}>
                  {app.status === 'running' ? (
                    <button className="btn btn-danger btn-sm" onClick={() => handleStop(app.id)}>Stop</button>
                  ) : (
                    <button className="btn btn-success btn-sm" onClick={() => handleStart(app.id)}>Start</button>
                  )}
                  <Link href={`/apps/${app.id}`} className="btn btn-secondary btn-sm">Details</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(app.id, app.name)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
