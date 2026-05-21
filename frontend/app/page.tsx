'use client';

import { useAuth } from './context/AuthContext';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { API_BASE } from './lib/api';

export default function LandingPage() {
  const { user, loading } = useAuth();

  // Terminal Simulation States
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [promptPath, setPromptPath] = useState('~');

  // Installer Tab Selection
  const [installMethod, setInstallMethod] = useState<'cargo' | 'source'>('cargo');

  // Command Builder State
  const [builderPort, setBuilderPort] = useState('3000');
  const [builderKey, setBuilderKey] = useState(user?.api_key || 'sh_usr_a1b2c3d4e5f6');

  // Clipboard copied indicators
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedConnect, setCopiedConnect] = useState(false);

  // FAQ Active Index
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Dynamic Server URL Calculation
  const [serverUrl, setServerUrl] = useState('ws://localhost:3001/ws/tunnel');

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

  // Update API Key if user loads later
  useEffect(() => {
    if (user?.api_key) {
      setBuilderKey(user.api_key);
    }
  }, [user]);

  // Terminal Typing Animation Loop
  useEffect(() => {
    let active = true;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const runAnimation = async () => {
      while (active) {
        // Clear terminal & reset browser
        setTerminalLines([]);
        setShowBrowser(false);
        setPromptPath('~');
        await sleep(1200);
        if (!active) break;

        // Command 1: Type cargo installer
        const cmd1 = 'cargo install --git https://github.com/ishangautam7/SelfHost --bin agent';
        for (let i = 1; i <= cmd1.length; i++) {
          setCurrentPrompt(cmd1.substring(0, i));
          await sleep(40);
          if (!active) break;
        }
        await sleep(800);
        if (!active) break;

        setTerminalLines(prev => [...prev, `~ ${cmd1}`]);
        setCurrentPrompt('');
        setTerminalLines(prev => [
          ...prev,
          '  Updating git repository `https://github.com/ishangautam7/SelfHost`',
          '   Compiling shared v0.1.0',
          '   Compiling agent v0.1.0',
          '    Finished release [optimized] target(s) in 2.34s',
          '  Installing ~/.cargo/bin/agent',
          '   Installed package `agent v0.1.0` (executable `agent`)'
        ]);
        await sleep(1800);
        if (!active) break;

        // Command 2: Type connect command
        setPromptPath('~');
        const cmd2 = `agent connect --server ${serverUrl} --api-key ${user?.api_key || 'sh_usr_a1b2c3d4'} --agent-id my-device`;
        // Limit display string in typing loop to prevent infinite wrapping
        const displayCmd = `agent connect --server .../ws/tunnel --api-key sh_usr_7x9a8b --agent-id my-device`;
        for (let i = 1; i <= displayCmd.length; i++) {
          setCurrentPrompt(displayCmd.substring(0, i));
          await sleep(35);
          if (!active) break;
        }
        await sleep(600);
        if (!active) break;

        setTerminalLines(prev => [...prev, `~ ${cmd2}`]);
        setCurrentPrompt('');

        setTerminalLines(prev => [
          ...prev,
          '[INFO] SelfHost Agent starting...',
          '[INFO] Agent ID: my-device',
          '[INFO] Connecting to server...',
          '[INFO] WebSocket handshakes complete!',
          '[INFO] Connection established successfully!',
          '[INFO] Tunnel live: local port 3000 mapped to public domain!'
        ]);

        await sleep(800);
        if (!active) break;

        // Trigger browser mockup to slide up
        setShowBrowser(true);

        // Wait at active state
        await sleep(10000);
      }
    };

    runAnimation();
    return () => {
      active = false;
    };
  }, [serverUrl, user]);

  // Copy helpers
  const handleCopyInstall = () => {
    const text = installMethod === 'cargo'
      ? 'cargo install --git https://github.com/ishangautam7/SelfHost --bin agent'
      : 'git clone https://github.com/ishangautam7/SelfHost.git\ncd SelfHost/agent\ncargo build --release';
    navigator.clipboard.writeText(text);
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const handleCopyConnect = () => {
    const binary = installMethod === 'cargo' ? 'agent' : './target/release/agent';
    const text = `${binary} connect --server ${serverUrl} --api-key ${builderKey} --agent-id my-device`;
    navigator.clipboard.writeText(text);
    setCopiedConnect(true);
    setTimeout(() => setCopiedConnect(false), 2000);
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqData = [
    {
      q: 'How does the tunnel routing work?',
      a: 'The SelfHost agent creates a persistent outgoing WebSocket connection to our Control Server. When an internet user visits your assigned subdomain, our server receives the request, wraps it, and sends it over the WebSocket to the agent on your machine. The agent forwards it to your local application, grabs the response, and sends it back securely.'
    },
    {
      q: 'Do I need to configure port forwarding or dynamic DNS?',
      a: 'No. Because the WebSocket connection is established from your local machine outwards, it bypasses routers, firewalls, double-NAT setups, and strict home networks automatically. No incoming port forwarding (such as port 80 or 443) is required.'
    },
    {
      q: 'Is the tunnel traffic secure?',
      a: 'Absolutely. All web traffic from the client browser to the Control Server is encrypted via SSL/TLS (HTTPS). The server then securely tunnels it to the local agent over a secure WebSocket (WSS) connection. No raw port exposures are made.'
    },
    {
      q: 'Can I host multiple applications simultaneously?',
      a: 'Yes! You can run multiple separate applications on different local ports (e.g., port 3000 for your React frontend and port 5000 for an Express API). You can deploy each app inside your SelfHost dashboard and associate them with different subdomains, all powered by a single running agent!'
    }
  ];

  return (
    <div className={styles.landing}>
      {/* Animated Glowing Orbs */}
      <div className="mesh-bg" />

      {/* Glassy Sticky Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.navLogo}>
            <div className={styles.logoMark}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </div>
            SelfHost
          </Link>
          <div className={styles.navRight}>
            <a href="#docs" className={styles.navLink}>Quick Start</a>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#faq" className={styles.navLink}>FAQ</a>
            {!loading && (
              user ? (
                <Link href="/dashboard" className="btn btn-primary btn-sm">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className={styles.navLink}>Log In</Link>
                  <Link href="/register" className="btn btn-gradient btn-sm">
                    Sign Up
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </nav>

      {/* First Viewport: Immersive Hero Section */}
      <main className={styles.heroSection}>
        <div className={styles.heroInner}>
          {/* Left Hero Content */}
          <div className={styles.heroLeft}>
            <h1 className={styles.heroTitle}>
              Turn your device into <span>the cloud</span>.
            </h1>
            <p className={styles.heroSubtitle}>
              SelfHost connects your local machine to the global web via secure WebSocket tunnels. Map ports to public subdomains instantly with zero complex setups, firewalls, or fees.
            </p>
            <div className={styles.heroActions}>
              {user ? (
                <Link href="/dashboard" className="btn btn-gradient btn-lg">
                  Go to Dashboard
                </Link>
              ) : (
                <Link href="/register" className="btn btn-gradient btn-lg">
                  Get Started for Free
                </Link>
              )}
              <a href="#docs" className="btn btn-secondary btn-lg">
                View Quick Start
              </a>
            </div>
          </div>

          {/* Right Hero Simulator */}
          <div className={styles.heroRight}>
            <div className={styles.simulatorWrap}>
              {/* Terminal Frame */}
              <div className={styles.terminalFrame}>
                <div className={styles.terminalHeader}>
                  <div className={styles.macDots}>
                    <div className={`${styles.macDot} ${styles.macRed}`} />
                    <div className={`${styles.macDot} ${styles.macYellow}`} />
                    <div className={`${styles.macDot} ${styles.macGreen}`} />
                  </div>
                  <div className={styles.terminalTab}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    bash (selfhost-agent)
                  </div>
                  <div style={{ width: 40 }} />
                </div>
                <div className={styles.terminalBody}>
                  {terminalLines.map((line, idx) => (
                    <div key={idx} style={{ color: line.startsWith('~') ? '#fff' : line.startsWith('[') ? 'var(--text-secondary)' : '#c9d1d9' }}>
                      {line.startsWith('~') ? (
                        <>
                          <span className={styles.prompt}>$</span>
                          {line.substring(2)}
                        </>
                      ) : line}
                    </div>
                  ))}
                  <div>
                    <span className={styles.prompt}>$</span>
                    {currentPrompt}
                    <span className={styles.cursor} />
                  </div>
                </div>
              </div>

              {/* Browser Mockup Panel */}
              <div className={`${styles.browserMockup} ${showBrowser ? styles.browserActive : ''}`}>
                <div className={styles.browserHeader}>
                  <div className={styles.macDots}>
                    <div className={`${styles.macDot} ${styles.macRed}`} style={{ width: 8, height: 8 }} />
                    <div className={`${styles.macDot} ${styles.macYellow}`} style={{ width: 8, height: 8 }} />
                    <div className={`${styles.macDot} ${styles.macGreen}`} style={{ width: 8, height: 8 }} />
                  </div>
                  <div className={styles.browserUrl}>
                    https://<span>react-app</span>.selfhost.ishangautam7.com.np
                  </div>
                </div>
                <div className={styles.browserBody}>
                  <h4 className={styles.browserTitle}>React App Hosted Locally</h4>
                  <p className={styles.browserDesc}>
                    Tunnelling localhost:3000 securely. Bypassing firewalls and NAT dynamically.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Section 2: Interactive Documentation */}
      <section id="docs" className={styles.docsSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Developer Quick Start</span>
          <h2 className={styles.sectionTitle}>Get Live in 3 Simple Steps</h2>
          <p className={styles.sectionSubtitle}>
            Install the custom lightweight agent on your local computer, hook it to your account credentials, and connect your services instantly.
          </p>
        </div>

        <div className={styles.timeline}>
          {/* Step 1: Install */}
          <div className={styles.stepWrapper}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <div className={styles.stepCard}>
                <h3 className={styles.stepTitle}>Install the Rust Host Agent</h3>
                <p className={styles.stepDesc}>
                  Download and compile the lightweight agent client. It sits on your server or developer environment and handles safe connections.
                </p>

                {/* Tabs to select install method */}
                <div className={styles.installTabs}>
                  <button
                    className={`${styles.tabBtn} ${installMethod === 'cargo' ? styles.tabBtnActive : ''}`}
                    onClick={() => setInstallMethod('cargo')}
                  >
                    Cargo Install (Fastest)
                  </button>
                  <button
                    className={`${styles.tabBtn} ${installMethod === 'source' ? styles.tabBtnActive : ''}`}
                    onClick={() => setInstallMethod('source')}
                  >
                    Build from Source
                  </button>
                </div>

                {/* Command Block */}
                <div className={styles.commandBlock}>
                  <div className={styles.commandText}>
                    {installMethod === 'cargo' ? (
                      <span>cargo install --git https://github.com/ishangautam7/SelfHost --bin agent</span>
                    ) : (
                      <span>
                        git clone https://github.com/ishangautam7/SelfHost.git && \<br />
                        cd SelfHost/agent && \<br />
                        cargo build --release
                      </span>
                    )}
                  </div>
                  <button
                    className={`${styles.copyBtn} ${copiedInstall ? styles.copyBtnActive : ''}`}
                    onClick={handleCopyInstall}
                    title="Copy command"
                  >
                    {copiedInstall ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Step 2: Get Key */}
          <div className={styles.stepWrapper}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <div className={styles.stepCard}>
                <h3 className={styles.stepTitle}>Obtain Your Connection Credentials</h3>
                <p className={styles.stepDesc}>
                  Every developer account comes with a unique Agent API Key. It authenticates your local machine tunnels and assigns subdomains automatically under your account.
                </p>
                {user ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link href="/dashboard" className="btn btn-secondary btn-sm">
                      Open Dashboard
                    </Link>
                    <span style={{ fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> You are logged in! Proceed to Step 3.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Link href="/register" className="btn btn-gradient btn-sm">
                      Create Free Account
                    </Link>
                    <Link href="/login" className="btn btn-secondary btn-sm">
                      Sign In
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Command Builder */}
          <div className={styles.stepWrapper}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <div className={styles.stepCard}>
                <h3 className={styles.stepTitle}>Connect and Publish</h3>
                <p className={styles.stepDesc}>
                  Customize the parameters below to generate your direct CLI command. Run it in your terminal, and map your applications instantly!
                </p>

                {/* Form Builder controls */}
                <div className={styles.builderForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Local Target Port</label>
                    <input
                      type=""
                      className={styles.formInput}
                      placeholder="e.g. 3000"
                      value={builderPort}
                      onChange={(e) => setBuilderPort(e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Your API Key</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="Paste sh_usr_..."
                      value={builderKey}
                      onChange={(e) => setBuilderKey(e.target.value)}
                    />
                  </div>
                </div>

                {/* Dynamic Output block */}
                <div className={styles.commandBlock}>
                  <div className={styles.commandText}>
                    <span>
                      {installMethod === 'cargo' ? 'agent' : './target/release/agent'} connect \<br />
                      &nbsp;&nbsp;--server {serverUrl} \<br />
                      &nbsp;&nbsp;--api-key {builderKey || '<your-api-key>'} \<br />
                      &nbsp;&nbsp;--agent-id my-device
                    </span>
                  </div>
                  <button
                    className={`${styles.copyBtn} ${copiedConnect ? styles.copyBtnActive : ''}`}
                    onClick={handleCopyConnect}
                    title="Copy command"
                  >
                    {copiedConnect ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    )}
                  </button>
                </div>

                <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Once the agent is connected, head to the <Link href="/deploy" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Deploy New App</Link> page, register local port <strong>{builderPort || '3000'}</strong>, and get your public subdomain immediately!
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Slick Features Grid */}
      <section id="features" className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Features</span>
          <h2 className={styles.sectionTitle}>Everything You Need to Host</h2>
          <p className={styles.sectionSubtitle}>
            SelfHost provides core production infrastructure utilities wrapped inside a simple user experience.
          </p>
        </div>

        <div className={styles.featuresGrid}>
          {/* Card 1 */}
          <div className="card card-glow">
            <div className={styles.featureIconWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Instant Global Subdomains</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Get a dedicated public URL for your apps (e.g. appname.selfhost.ishangautam7.com.np) with custom bindings. Route external requests instantly down to your terminal ports.
            </p>
          </div>

          {/* Card 2 */}
          <div className="card card-glow">
            <div className={styles.featureIconWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                <rect x="9" y="9" width="6" height="6"></rect>
                <line x1="9" y1="1" x2="9" y2="4"></line>
                <line x1="15" y1="1" x2="15" y2="4"></line>
                <line x1="9" y1="20" x2="9" y2="23"></line>
                <line x1="15" y1="20" x2="15" y2="23"></line>
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Secure Rust WebSockets</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              The high-performance Rust host agent uses persistent, low-overhead WebSocket tunnels to pass incoming HTTP data packages safely, bypassing firewalls and strict routers.
            </p>
          </div>

          {/* Card 3 */}
          <div className="card card-glow">
            <div className={styles.featureIconWrap}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Device & Agent Portal</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Keep tabs on your active devices, agent connections, and tunnel health directly from your developer dashboard. Stop, start, or delete tunnels on demand.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Accordion FAQ */}
      <section id="faq" className={styles.faqSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>FAQ</span>
          <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>
          <p className={styles.sectionSubtitle}>
            Have questions about how SelfHost manages tunnels, security, or domain configuration? Here are the answers.
          </p>
        </div>

        <div className={styles.faqList}>
          {faqData.map((faq, idx) => (
            <div key={idx} className={styles.faqItem}>
              <div
                className={styles.faqHeader}
                onClick={() => toggleFaq(idx)}
              >
                <h4 className={styles.faqQuestion}>{faq.q}</h4>
                <div className={`${styles.faqIcon} ${activeFaq === idx ? styles.faqIconActive : ''}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              <div className={`${styles.faqBody} ${activeFaq === idx ? styles.faqBodyActive : ''}`}>
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>&copy; {new Date().getFullYear()} SelfHost. Built for modern self-hosting.</span>
          <div className={styles.footerLinks}>
            <a href="https://github.com/ishangautam7/SelfHost" target="_blank" rel="noreferrer" className={styles.navLink}>
              GitHub Repository
            </a>
            <a href="#docs" className={styles.navLink}>Documentation</a>
            <a href="#faq" className={styles.navLink}>Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
