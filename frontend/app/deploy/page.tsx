'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { createApp } from '../lib/api';
import Link from 'next/link';
import styles from './deploy.module.css';

export default function DeployPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [localPort, setLocalPort] = useState(3000);
  const [cpu, setCpu] = useState(1);
  const [memory, setMemory] = useState(512);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    // Auto-generate subdomain from name
    const sub = val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    setSubdomain(sub);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await createApp({
        name,
        subdomain,
        local_port: localPort,
        resource_cpu: cpu,
        resource_memory: memory,
      });
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
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h1>Deploy New App</h1>
            <p>Configure your application and get a public URL instantly</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

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
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="my-app"
                  required
                />
                <span className={styles.subdomainSuffix}>.selfhost.ishangautam7.com.np</span>
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
              <span className={styles.hint}>The port your app runs on locally (e.g., 3000, 8080)</span>
            </div>

            <div className={styles.resourceRow}>
              <div className={styles.field}>
                <label className="label">CPU Cores</label>
                <div className={styles.rangeWrap}>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    value={cpu}
                    onChange={(e) => setCpu(parseInt(e.target.value))}
                    className={styles.range}
                  />
                  <span className={styles.rangeValue}>{cpu}</span>
                </div>
              </div>
              <div className={styles.field}>
                <label className="label">Memory (MB)</label>
                <div className={styles.rangeWrap}>
                  <input
                    type="range"
                    min={128}
                    max={4096}
                    step={128}
                    value={memory}
                    onChange={(e) => setMemory(parseInt(e.target.value))}
                    className={styles.range}
                  />
                  <span className={styles.rangeValue}>{memory} MB</span>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className={styles.preview}>
              <h3>Preview</h3>
              <div className={styles.previewUrl}>
                <code>{subdomain || 'your-app'}.selfhost.ishangautam7.com.np</code>
              </div>
              <div className={styles.previewDetails}>
                <span>Port: {localPort}</span>
                <span>CPU: {cpu} core{cpu > 1 ? 's' : ''}</span>
                <span>RAM: {memory} MB</span>
              </div>
            </div>

            <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
              {loading ? 'Deploying...' : 'Deploy App'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
