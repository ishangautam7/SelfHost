'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { createApp, listActiveAgents, ActiveAgent } from '../lib/api';
import Link from 'next/link';
import styles from './deploy.module.css';

export default function DeployPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [localPort, setLocalPort] = useState(3000);
  const [agents, setAgents] = useState<ActiveAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      listActiveAgents()
        .then((data) => {
          setAgents(data);
          if (data.length > 0) {
            setSelectedAgent(data[0].agent_id);
          }
        })
        .catch((err) => console.error('Failed to load active agents:', err));
    }
  }, [user]);

  const handleNameChange = (val: string) => {
    setName(val);
    const sub = val
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setSubdomain(sub);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createApp({ name, subdomain, local_port: localPort, agent_id: selectedAgent || undefined });
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create app');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.page}>
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/dashboard" className={styles.backLink}>
            ← Dashboard
          </Link>
          <Link href="/dashboard" className={styles.navLogo}>
            <div className={styles.logoMark}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </div>
            <span className={styles.logoText}>SelfHost</span>
          </Link>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.layout}>
          {/* Form */}
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h1 className={styles.pageTitle}>Deploy New App</h1>
              <p>Configure your app and get a public URL backed by your device</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {error && (
                <div className={styles.error}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> {error}
                </div>
              )}

              <div className={styles.field}>
                <label className="label" htmlFor="name">App Name</label>
                <input
                  id="name"
                  className="input"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Awesome App"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className="label" htmlFor="subdomain">Subdomain</label>
                <div className={styles.subdomainWrap}>
                  <input
                    id="subdomain"
                    className={`input ${styles.subdomainInput}`}
                    value={subdomain}
                    onChange={(e) =>
                      setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }
                    placeholder="my-app"
                    required
                  />
                  <span className={styles.subdomainSuffix}>-{user.username}.selfhost.ishangautam7.com.np</span>
                </div>
              </div>

              <div className={styles.field}>
                <label className="label" htmlFor="port">Local Port</label>
                <input
                  id="port"
                  className="input"
                  type="number"
                  min={1}
                  max={65535}
                  value={localPort}
                  onChange={(e) => setLocalPort(parseInt(e.target.value) || 3000)}
                  required
                />
                <span className={styles.hint}>The port your app listens on (e.g. 3000, 8080)</span>
              </div>

              {/* Agent Selection */}
              {agents.length === 0 ? (
                <div className={styles.warningBox}>
                  <div className={styles.warningHeader}>
                    <span className={styles.warningIcon}>⚠️</span>
                    <strong>No active agents connected</strong>
                  </div>
                  <p className={styles.warningText}>
                    To deploy and route requests, please connect at least one agent client on your device.
                    <br/><br/>
                    <strong>How to connect:</strong> Run <code>cargo run --release --bin agent -- connect ...</code> using the command from your dashboard.
                  </p>
                </div>
              ) : agents.length === 1 ? (
                <div className={styles.field}>
                  <label className="label">Target Device / Agent</label>
                  <div className={styles.singleAgentBadge}>
                    <span className={styles.agentActiveDot}></span>
                    <code>{agents[0].agent_id}</code> (Active)
                  </div>
                </div>
              ) : (
                <div className={styles.field}>
                  <label className="label" htmlFor="agent">Target Device / Agent</label>
                  <select
                    id="agent"
                    className="input"
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    required
                  >
                    {agents.map((ag) => (
                      <option key={ag.agent_id} value={ag.agent_id}>
                        {ag.agent_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <><span className="spinner" /> Deploying...</>
                ) : (
                  'Deploy App'
                )}
              </button>
            </form>
          </div>

          {/* Preview Sidebar */}
          <div className={styles.previewCard}>
            <h3>Live Preview</h3>

            <div className={styles.previewUrl}>
              <code>{subdomain || 'your-app'}-{user.username}.selfhost.ishangautam7.com.np</code>
            </div>

            <div className={styles.previewDetails}>
              <div className={styles.previewRow}>
                <span className={styles.previewRowLabel}>Local port</span>
                <span className={styles.previewRowValue}>{localPort}</span>
              </div>
              <div className={styles.previewRow}>
                <span className={styles.previewRowLabel}>Status</span>
                <span className="badge badge-stopped" style={{ fontSize: 11 }}>
                  <span className="badge-dot" /> stopped
                </span>
              </div>
            </div>

            <div className={styles.tips}>
              <div className={styles.tip}>
                <span className={styles.tipIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21h6"></path><path d="M12 22v-5"></path><path d="M12 17a5 5 0 0 1-5-5V9a5 5 0 0 1 10 0v3a5 5 0 0 1-5 5z"></path></svg>
                </span>
                <span>The agent on your device must be running to serve traffic.</span>
              </div>
              <div className={styles.tip}>
                <span className={styles.tipIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </span>
                <span>Subdomains are globally unique — first-come, first-served.</span>
              </div>
              <div className={styles.tip}>
                <span className={styles.tipIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                </span>
                <span>You can start/stop apps anytime from the dashboard.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
