import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { DocsPanel } from './components/DocsPanel';
import './index.css';

const DocsPage = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('keel-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('keel-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="docs-page-wrapper" style={styles.docsPageWrapper}>
      {/* Docs Header */}
      <header className="docs-header" style={styles.docsHeader}>
        <div className="docs-header-container" style={styles.headerContainer}>
          <div style={styles.logoRow}>
            <svg style={styles.logoSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8v10M8 14h8" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={styles.brandTitle}>Keel Docs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
            <a href="/" style={styles.backLink}>Back to app</a>
          </div>
        </div>
      </header>

      {/* Docs Content */}
      <main className="docs-main-content" style={styles.docsContent}>
        <DocsPanel />
      </main>

      {/* Docs Footer */}
      <footer className="docs-footer" style={styles.docsFooter}>
        <div className="docs-footer-container" style={styles.footerContainer}>
          <span>© 2026 Keel.</span>
        </div>
      </footer>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DocsPage />
  </React.StrictMode>
);

const styles = {
  docsPageWrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-color)',
  },
  docsHeader: {
    backgroundColor: 'var(--container-bg)',
    borderBottom: '1px solid var(--border-color)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  headerContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoSvg: {
    width: '28px',
    height: '28px',
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  backLink: {
    fontSize: '13.5px',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    fontWeight: '600',
    border: '1px solid var(--border-color)',
    padding: '8px 16px',
    borderRadius: '100px',
    backgroundColor: 'var(--container-bg)',
    transition: 'all 0.15s ease',
  },
  docsContent: {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '40px 20px',
    flex: 1,
    display: 'flex',
  },
  docsFooter: {
    borderTop: '1px solid var(--border-color)',
    padding: '24px 20px',
    backgroundColor: 'var(--container-bg)',
  },
  footerContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
};
