import React from 'react';
import { KeelAxis } from './KeelAxis';
import { getHealthLabel } from '../utils/keelLogic';

interface SwapContextSidebarProps {
  token0Vol: number;
  token1Vol: number;
  imbalanceBps: number;
  recoveryBudget: number;
  stableSymbol: string;
}

export const SwapContextSidebar: React.FC<SwapContextSidebarProps> = ({
  token0Vol,
  token1Vol,
  imbalanceBps,
  recoveryBudget,
  stableSymbol,
}) => {
  const healthLabel = getHealthLabel(imbalanceBps);
  
  const dominantFlow = token0Vol === token1Vol 
    ? 'Neutral' 
    : (token0Vol > token1Vol ? `OKB -> ${stableSymbol}` : `${stableSymbol} -> OKB`);

  const mode = imbalanceBps < 1500 ? 'Centered' : 'Defensive';

  return (
    <div style={styles.container} className="glass-panel">
      <div style={styles.header}>
        <span style={styles.title}>KEEL AXIS</span>
      </div>
      
      <div style={styles.axisWrapper}>
        <KeelAxis 
          token0Vol={token0Vol}
          token1Vol={token1Vol}
          imbalanceBps={imbalanceBps}
        />
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metricRow}>
          <span style={styles.metricLabel}>Pool Health</span>
          <span style={{ 
            ...styles.metricValue, 
            color: imbalanceBps >= 1500 ? 'var(--text-primary)' : '#10B981',
            fontWeight: '600'
          }}>
            {healthLabel}
          </span>
        </div>
        
        <div style={styles.metricRow}>
          <span style={styles.metricLabel}>Imbalance</span>
          <span style={styles.metricValue}>
            {(imbalanceBps / 100).toFixed(2)}%
          </span>
        </div>

        <div style={styles.metricRow}>
          <span style={styles.metricLabel}>Dominant Flow</span>
          <span style={styles.metricValue}>
            {dominantFlow}
          </span>
        </div>

        <div style={styles.metricRow}>
          <span style={styles.metricLabel}>Mode</span>
          <span style={{
            ...styles.metricValue,
            color: mode === 'Defensive' ? '#E11D48' : 'var(--text-primary)'
          }}>
            {mode}
          </span>
        </div>

        <div style={styles.divider} />

        <div style={styles.metricRow}>
          <span style={styles.metricLabel}>Recovery Budget</span>
          <span style={{ ...styles.metricValue, fontWeight: '700' }}>
            {recoveryBudget.toFixed(4)} {stableSymbol}
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '14px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
  axisWrapper: {
    margin: '12px 0',
  },
  metricsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    backgroundColor: 'var(--bg-color)',
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '4px 0',
  },
};
