import React from 'react';

interface LandingPageProps {
  onScrollToDashboard: () => void;
  onInjectToxicFlow: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onScrollToDashboard,
  onInjectToxicFlow,
}) => {
  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <section id="overview" style={styles.heroSection}>
        <div style={styles.heroRowLayout}>
          <div style={styles.heroContent}>
            <div style={styles.heroBadge}>Uniswap v4 Hook Protocol</div>
            <h1 style={styles.heroTitle}>
              TOXIC FLOW FUNDS CORRECTIVE FLOW.
            </h1>
            <p style={styles.heroSubtitle}>
              A self-stabilizing inventory protection hook that forces imbalance-expanding swaps to fund the recovery of the pool.
            </p>
            <div style={styles.ctaRow}>
              <button 
                onClick={onInjectToxicFlow} 
                style={styles.primaryBtn}
              >
                Inspect Live Pool
              </button>
              <button 
                onClick={onScrollToDashboard} 
                style={styles.secondaryBtn}
              >
                Execute Swap
              </button>
            </div>
          </div>

          <div style={styles.heroImageCol}>
            <div style={styles.heroImageWrapper}>
              <img 
                src="/keel_light_hero.png" 
                alt="KEEL Balance Stabilizer Graphic" 
                style={styles.heroImage} 
              />
            </div>
          </div>
        </div>

        {/* Comparison Row */}
        <div style={styles.comparisonBanner}>
          <div style={styles.bannerCol}>
            <span style={styles.bannerHeader}>Standard AMM Pools</span>
            <span style={styles.bannerText}>• Passive inventory depletion</span>
            <span style={styles.bannerText}>• LPs absorb directional toxic damage</span>
            <span style={styles.bannerText}>• Static fees during intensive pool drain</span>
          </div>
          <div style={{ ...styles.bannerCol, borderLeft: '1px solid var(--border-color)', paddingLeft: '32px' }}>
            <span style={{ ...styles.bannerHeader, color: 'var(--text-primary)' }}>KEEL Active Pools</span>
            <span style={styles.bannerText}>• Self-stabilizing flow engine</span>
            <span style={styles.bannerText}>• Harmful flow builds recovery reserves</span>
            <span style={styles.bannerText}>• Dynamic incentives reward corrective swaps</span>
          </div>
        </div>
      </section>

      {/* Section: The Pain */}
      <section id="problem" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>01 / Structural Risk</span>
          <h2 style={styles.sectionTitle}>AMMs are passive inventory sinks</h2>
        </div>
        <div style={styles.contentGrid}>
          <div style={styles.descText}>
            <p>
              When one-sided market flow hits a pool, liquidity providers absorb the structural loss. Standard constant-product curves cannot identify whether a trade is stabilizing or draining reserves.
            </p>
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
              Arbitrageurs and directional traders repeatedly swap in the same direction, pushing pool balance to critical bounds, causing capsizing risk and severe impermanent loss.
            </p>
          </div>
          <div style={styles.visualConsole}>
            <div style={styles.flowRow}>
              <span>TOKEN_A → USDC [Imbalance Expand]</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Dominant Flow</span>
            </div>
            <div style={styles.flowRow}>
              <span>TOKEN_A → USDC [Imbalance Expand]</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Dominant Flow</span>
            </div>
            <div style={styles.flowRow}>
              <span>TOKEN_A → USDC [Imbalance Expand]</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Dominant Flow</span>
            </div>
            <div style={styles.flowAlert}>
              Imbalance increases. LP inventory risk rises. Fees stay static.
            </div>
          </div>
        </div>
      </section>

      {/* Section: The Stabilization Loop */}
      <section id="mechanism" style={styles.sectionCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTag}>02 / Active Stabilization</span>
          <h2 style={styles.sectionTitle}>The self-correcting incentive loop</h2>
        </div>
        <div style={styles.contentGrid}>
          <div style={styles.stepsList}>
            <div style={styles.stepItem}>
              <span style={styles.stepNum}>1</span>
              <div>
                <span style={styles.stepTitle}>Observe Pool Flow</span>
                <span style={styles.stepBody}>The Hook tracks directional transaction volume in real time.</span>
              </div>
            </div>
            <div style={styles.stepItem}>
              <span style={styles.stepNum}>2</span>
              <div>
                <span style={styles.stepTitle}>Apply Dynamic Friction</span>
                <span style={styles.stepBody}>Toxic swaps that worsen imbalance are charged a dynamic surcharge.</span>
              </div>
            </div>
            <div style={styles.stepItem}>
              <span style={styles.stepNum}>3</span>
              <div>
                <span style={styles.stepTitle}>Fund Recovery Vault</span>
                <span style={styles.stepBody}>Surcharges are automatically collected in the pool recovery budget.</span>
              </div>
            </div>
            <div style={styles.stepItem}>
              <span style={styles.stepNum}>4</span>
              <div>
                <span style={styles.stepTitle}>Reward Corrective Swaps</span>
                <span style={styles.stepBody}>Healing swaps receive fee discounts and recovery credits.</span>
              </div>
            </div>
          </div>
          <div style={styles.quoteCard}>
            <div style={styles.quoteLine}>Toxic flow becomes the utility engine that repairs pool balance.</div>
            <div style={styles.quoteBody}>
              By forcing pool exploiters to fund the incentives for pool balancers, the pool stabilizes itself autonomously onchain without relying on external oracles.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '40px',
  },
  heroSection: {
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-xl)',
    padding: '48px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '48px',
    boxShadow: 'var(--shadow-premium)',
  },
  heroRowLayout: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '48px',
    alignItems: 'center',
    width: '100%',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    color: 'var(--text-primary)',
    padding: '6px 14px',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  heroContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    flex: 1.2,
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: '700',
    fontFamily: 'var(--font-display)',
    lineHeight: '1.05',
    letterSpacing: '-1.5px',
    color: 'var(--text-primary)',
  },
  heroSubtitle: {
    fontSize: '18px',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
  },
  ctaRow: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
  },
  primaryBtn: {
    padding: '14px 28px',
    backgroundColor: 'var(--text-primary)',
    border: 'none',
    color: 'var(--container-bg)',
    fontWeight: '700',
    fontSize: '13px',
    borderRadius: 'var(--border-radius-sm)',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    boxShadow: 'var(--shadow-button)',
  },
  secondaryBtn: {
    padding: '14px 28px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '13px',
    borderRadius: 'var(--border-radius-sm)',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    transition: 'var(--transition-smooth)',
    boxShadow: 'var(--shadow-button)',
  },
  heroImageCol: {
    flex: 0.8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImageWrapper: {
    width: '100%',
    maxWidth: '320px',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
  },
  heroImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  comparisonBanner: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '40px',
    gap: '40px',
  },
  bannerCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  bannerHeader: {
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  bannerText: {
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
  },
  sectionCard: {
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-xl)',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
    boxShadow: 'var(--shadow-premium)',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '20px',
  },
  sectionTag: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '40px',
    alignItems: 'center',
  },
  descText: {
    fontSize: '15px',
    lineHeight: '1.6',
    color: 'var(--text-primary)',
  },
  visualConsole: {
    backgroundColor: 'var(--container-bg-hover)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },
  flowRow: {
    padding: '10px 14px',
    backgroundColor: 'var(--container-bg)',
    borderRadius: 'var(--border-radius-sm)',
    borderLeft: '3px solid var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderLeftWidth: '3px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flowAlert: {
    marginTop: '8px',
    padding: '12px',
    borderRadius: 'var(--border-radius-sm)',
    border: '1px dashed var(--border-color)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    fontSize: '11px',
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  stepItem: {
    display: 'flex',
    gap: '20px',
  },
  stepNum: {
    width: '32px',
    height: '32px',
    borderRadius: '100px',
    border: '1px solid var(--text-primary)',
    backgroundColor: 'var(--container-bg-hover)',
    color: 'var(--text-primary)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    fontWeight: '700',
    flexShrink: 0,
  },
  stepTitle: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
    color: 'var(--text-primary)',
  },
  stepBody: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  quoteCard: {
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-lg)',
    padding: '36px',
    backgroundColor: 'var(--container-bg-hover)',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    gap: '16px',
  },
  quoteLine: {
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: '1.35',
    color: 'var(--text-primary)',
  },
  quoteBody: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
};
