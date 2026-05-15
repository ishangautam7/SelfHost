'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';
import styles from '../login/auth.module.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const user = await register(username, password);
      setUser(user);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          <h1>Create Account</h1>
          <p>Start hosting apps from your own device</p>
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
              placeholder="Choose a username"
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
              placeholder="At least 6 characters"
              required
            />
          </div>

          <div className={styles.field}>
            <label className="label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
            />
          </div>

          <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className={styles.authFooter}>
          Already have an account? <Link href="/login" className={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
