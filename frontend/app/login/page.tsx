'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import styles from './auth.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      setUser(user);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authBg}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>⬡</span>
            <span className={styles.logoText}>SelfHost</span>
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to manage your hosted applications</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className="label" htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>

          <div className={styles.field}>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className={styles.authFooter}>
          Don&apos;t have an account? <Link href="/register" className={styles.link}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
