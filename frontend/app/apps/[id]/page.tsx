'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { App, getApp, startApp, stopApp, deleteApp, updateApp } from '../../lib/api';
import Link from 'next/link';
import styles from './detail.module.css';

export default function AppDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const appId = params.id as string;

  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editPort, setEditPort] = useState(0);
  const [editCpu, setEditCpu] = useState(1);
  const [editMemory, setEditMemory] = useState(512);

  useEffect(() => {
    if (user && appId) {
      loadApp();
      const interval = setInterval(loadApp, 3000);
      return () => clearInterval(interval);
    }
  }, [user, appId]);

  const loadApp = async () => {
    try {
      const data = await getApp(appId);
      setApp(data);
      if (!editing) {
        setEditPort(data.local_port);
        setEditCpu(data.resource_cpu);
        setEditMemory(data.resource_memory);
      }
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    try { await startApp(appId); loadApp(); } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleStop = async () => {
    try { await stopApp(appId); loadApp(); } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${app?.name}"? This cannot be undone.`)) return;
    try { await deleteApp(appId); router.push('/dashboard'); } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  const handleSave = async () => {
    try {
      await updateApp(appId, {
        local_port: editPort,
        resource_cpu: editCpu,
        resource_memory: editMemory,
      });
      setEditing(false);
      loadApp();
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed'); }
  };

  if (!user || loading) return null;
  if (!app) return <div>App not found</div>;

  const fullDomain = `${app.subdomain}.selfhost.ishangautam7.com.np`;

  return (
    <div className={styles.page}>
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/dashboard" className={styles.backLink}>← Back to Dashboard</Link>
        </div>
      </nav>

      <main className={styles.main}>
        {/* App Header */}
        <div className={styles.header}>
          <div>
            <h1>{app.name}</h1>
            <span className={`badge badge-${app.status}`}>
              <span className="badge-dot" />
              {app.status}
            </span>
          </div>
          <div className={styles.headerActions}>
            {app.status === 'running' ? (
              <button className="btn btn-danger" onClick={handleStop}>⏹ Stop</button>
            ) : (
              <button className="btn btn-success" onClick={handleStart}>▶ Start</button>
            )}
            <button className="btn btn-danger" onClick={handleDelete}>🗑 Delete</button>
          </div>
        </div>

        {/* Domain Card */}
        <div className={`card ${styles.domainCard}`}>
          <h3>🌐 Public URL</h3>
          <div className={styles.domainRow}>
            <a href={`http://${fullDomain}`} target="_blank" rel="noreferrer" className={styles.domainUrl}>
              {fullDomain}
            </a>
            <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(`http://${fullDomain}`)}>
              Copy URL
            </button>
          </div>
        </div>

        {/* Config Card */}
        <div className={`card ${styles.configCard}`}>
          <div className={styles.configHeader}>
            <h3>⚙️ Configuration</h3>
            {!editing ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <div className={styles.editActions}>
                <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            )}
          </div>

          <div className={styles.configGrid}>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Subdomain</span>
              <span className={styles.configValue}>{app.subdomain}</span>
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Local Port</span>
              {editing ? (
                <input className="input" type="number" value={editPort} onChange={(e) => setEditPort(parseInt(e.target.value) || 0)} />
              ) : (
                <span className={styles.configValue}>{app.local_port}</span>
              )}
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>CPU Cores</span>
              {editing ? (
                <input className="input" type="number" min={1} max={4} value={editCpu} onChange={(e) => setEditCpu(parseInt(e.target.value) || 1)} />
              ) : (
                <span className={styles.configValue}>{app.resource_cpu}</span>
              )}
            </div>
            <div className={styles.configItem}>
              <span className={styles.configLabel}>Memory</span>
              {editing ? (
                <input className="input" type="number" min={128} step={128} value={editMemory} onChange={(e) => setEditMemory(parseInt(e.target.value) || 512)} />
              ) : (
                <span className={styles.configValue}>{app.resource_memory} MB</span>
              )}
            </div>
          </div>
        </div>

        {/* Agent Setup Guide */}
        <div className={`card ${styles.guideCard}`}>
          <h3>🖥️ Connect Agent</h3>
          <p>Run this on the device where your app is running:</p>
          <pre className={styles.codeBlock}>
{`# Install & run the SelfHost agent
cargo run --bin agent -- connect \\
  --server ws://YOUR_SERVER:8080/ws/tunnel \\
  --api-key ${user.api_key}`}
          </pre>
          <p className={styles.guideNote}>
            The agent will automatically forward traffic from <code>{fullDomain}</code> to <code>localhost:{app.local_port}</code>
          </p>
        </div>

        <div className={styles.meta}>
          <span>Created: {new Date(app.created_at).toLocaleDateString()}</span>
          <span>App ID: {app.id}</span>
        </div>
      </main>
    </div>
  );
}
