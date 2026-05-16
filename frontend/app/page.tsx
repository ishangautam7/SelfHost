'use client';

import { useAuth } from './context/AuthContext';
import Link from 'next/link';
import styles from './page.module.css';

export default function LandingPage() {
  const { user, loading } = useAuth();

  return (
    <div className={styles.landing}>
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.navLogo}>
            <div className={styles.logoMark}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
            </div>
            SelfHost
          </Link>
          <div className={styles.navRight}>
            {!loading && (
              user ? (
                <Link href="/dashboard" className={styles.btnSecondary}>
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className={styles.navLink}>Log In</Link>
                  <Link href="/register" className={styles.btnPrimary}>Sign Up</Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Host applications directly from your own device.
        </h1>
        
        <p className={styles.heroSubtitle}>
          SelfHost creates secure WebSocket tunnels to your machine, providing instant global subdomains without cloud deployments.
        </p>
        
        <div className={styles.heroActions}>
          {user ? (
            <Link href="/dashboard" className={styles.btnPrimary}>
              Go to Dashboard
            </Link>
          ) : (
            <Link href="/register" className={styles.btnPrimary}>
              Get Started for Free
            </Link>
          )}
          <a href="https://github.com/ishangautam7/SelfHost" target="_blank" rel="noreferrer" className={styles.btnSecondary}>
            View Documentation
          </a>
        </div>
      </main>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
          <h3 className={styles.featureTitle}>Global Subdomains</h3>
          <p className={styles.featureDesc}>
            Get a unique, globally accessible subdomain for every application you deploy. Instantly map your local ports to the internet.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
          </div>
          <h3 className={styles.featureTitle}>Secure Tunnels</h3>
          <p className={styles.featureDesc}>
            Our high-performance Rust proxy agent maintains a persistent WebSocket connection, bypassing NAT and strict firewalls.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </div>
          <h3 className={styles.featureTitle}>Resource Control</h3>
          <p className={styles.featureDesc}>
            Monitor and allocate CPU cores and RAM for every hosted application straight from the developer dashboard.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>&copy; {new Date().getFullYear()} SelfHost.</span>
          <a href="https://github.com/ishangautam7/SelfHost" target="_blank" rel="noreferrer" className={styles.navLink}>GitHub Repository</a>
        </div>
      </footer>
    </div>
  );
}
