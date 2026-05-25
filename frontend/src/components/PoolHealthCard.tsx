import React from 'react';

interface PoolHealthCardProps {
  token0Vol: number;
  token1Vol: number;
  imbalanceBps: number;
  baseFee: number;
  minFee: number;
  maxFee: number;
  neutralThreshold: number;
  stableSymbol?: string;
}

export const PoolHealthCard: React.FC<PoolHealthCardProps> = ({
  token0Vol,
  token1Vol,
  imbalanceBps,
  baseFee,
  minFee,
  maxFee,
  neutralThreshold,
  stableSymbol = 'USDG',
}) => {
  const formatFee = (val: number) => {
    return `${(val / 10000).toFixed(2)}%`;
  };

  const formatBps = (val: number) => {
    return `${(val / 100).toFixed(2)}%`;
  };

  const formatVolume = (val: number) => {
    if (val === 0) return '0.00';
    if (Math.abs(val) < 0.01) return val.toFixed(6);
    return val.toFixed(4);
  };

  const getSystemStatus = () => {
    if (imbalanceBps < neutralThreshold) {
      return 'Balanced mode';
    } else {
      return 'Active dynamic friction';
    }
  };

  return (
    <div style={styles.container} className="glass-panel">
      <div style={styles.header}>
        <span style={styles.title}>Stabilization rules</span>
        <span style={{
          ...styles.badge,
          borderColor: imbalanceBps >= neutralThreshold ? 'var(--text-primary)' : 'var(--border-color)',
          color: imbalanceBps >= neutralThreshold ? 'var(--text-primary)' : 'var(--text-secondary)',
          backgroundColor: imbalanceBps >= neutralThreshold ? 'var(--container-bg-hover)' : 'transparent'
        }}>
          {getSystemStatus()}
        </span>
      </div>

      <div style={styles.content}>
        <div className="param-grid" style={styles.paramGrid}>
          <div style={styles.paramItem}>
            <span style={styles.paramLabel}>Base fee</span>
            <span style={styles.paramVal}>{formatFee(baseFee)}</span>
          </div>
          <div style={styles.paramItem}>
            <span style={styles.paramLabel}>Min fee</span>
            <span style={styles.paramVal}>{formatFee(minFee)}</span>
          </div>
          <div style={styles.paramItem}>
            <span style={styles.paramLabel}>Max fee</span>
            <span style={styles.paramVal}>{formatFee(maxFee)}</span>
          </div>
          <div style={styles.paramItem}>
            <span style={styles.paramLabel}>Neutral threshold</span>
            <span style={styles.paramVal}>{formatBps(neutralThreshold)}</span>
          </div>
        </div>

        <div style={styles.divider} />

        <div className="volume-row" style={styles.volumeRow}>
          <div style={styles.volumeCol}>
            <span style={styles.volLabel}>OKB -&gt; {stableSymbol} Volume</span>
            <span style={styles.volVal}>{formatVolume(token0Vol)} OKB</span>
          </div>
          <div style={styles.volumeCol}>
            <span style={styles.volLabel}>{stableSymbol} -&gt; OKB Volume</span>
            <span style={styles.volVal}>{formatVolume(token1Vol)} {stableSymbol}</span>
          </div>
        </div>

        <div className="volume-row" style={styles.volumeRow}>
          <div style={styles.volumeCol}>
            <span style={styles.volLabel}>Dominant direction</span>
            <span style={styles.volVal}>
              {imbalanceBps < neutralThreshold 
                ? 'None' 
                : (token0Vol > token1Vol ? `OKB -> ${stableSymbol}` : `${stableSymbol} -> OKB`)}
            </span>
          </div>
          <div style={styles.volumeCol}>
            <span style={styles.volLabel}>Pool status</span>
            <span style={{ 
              ...styles.volVal, 
              color: 'var(--text-primary)',
              fontWeight: '600'
            }}>
              {imbalanceBps >= neutralThreshold ? 'Strained' : 'Equilibrium'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  badge: {
    padding: '4px 14px',
    fontSize: '11px',
    fontWeight: '600',
    border: '1px solid',
    borderRadius: '100px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
  },
  paramGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  paramItem: {
    backgroundColor: 'var(--container-bg)',
    padding: '12px 16px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    fontFamily: 'var(--font-mono)',
  },
  paramLabel: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  paramVal: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
  },
  volumeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
  },
  volumeCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--container-bg)',
    padding: '12px 14px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--border-color)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
  },
  volLabel: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  volVal: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
};
