import React from 'react';

interface KeelAxisProps {
  token0Vol: number;
  token1Vol: number;
  imbalanceBps: number;
  stableSymbol?: string;
}

export const KeelAxis: React.FC<KeelAxisProps> = ({
  token0Vol,
  token1Vol,
  imbalanceBps,
  stableSymbol = 'USDG',
}) => {
  let tilt = 0;
  let dominantLabel = 'Stable equilibrium';
  let healthLabel = 'Centered';
  
  if (token0Vol + token1Vol > 0) {
    const pct = imbalanceBps / 100; // 0 to 100
    if (token0Vol > token1Vol) {
      tilt = -pct;
      dominantLabel = `OKB -> ${stableSymbol}`;
    } else if (token1Vol > token0Vol) {
      tilt = pct;
      dominantLabel = `${stableSymbol} -> OKB`;
    }
  }

  if (imbalanceBps < 1500) {
    healthLabel = 'Balanced';
  } else if (imbalanceBps < 3000) {
    healthLabel = 'Moderate leaning';
  } else if (imbalanceBps < 5000) {
    healthLabel = 'Strained flow';
  } else if (imbalanceBps < 7000) {
    healthLabel = 'Critical imbalance';
  } else {
    healthLabel = 'Capsizing bound reached';
  }

  // Pointer position from 0% (left) to 100% (right)
  const pointerPosition = 50 + (tilt / 2);

  const getHealthBadgeColor = () => {
    if (imbalanceBps >= 5000) return '#000000';
    if (imbalanceBps >= 1500) return '#333336';
    return '#5E616C';
  };

  return (
    <div style={styles.container} className="glass-panel">
      <div style={styles.header}>
        <span style={styles.title}>Keel axis monitor</span>
        <span style={{
          ...styles.badge,
          borderColor: getHealthBadgeColor(),
          color: getHealthBadgeColor(),
          backgroundColor: 'rgba(0, 0, 0, 0.03)'
        }}>
          {healthLabel}
        </span>
      </div>
      
      <p style={styles.subtitle}>
        Real-time tracking of directional volume. The axis tilts as swaps drain liquidity in one direction, triggering stabilizer surcharges to incentivize recovery.
      </p>

      <div style={styles.axisContainer}>
        {/* Scale divisions */}
        <div className="divisions" style={styles.divisions}>
          <span style={styles.divisionText}>Capsizing zone (port)</span>
          <span style={{ ...styles.divisionText, fontWeight: '600', color: 'var(--text-primary)' }}>Equilibrium</span>
          <span style={styles.divisionText}>Capsizing zone (starboard)</span>
        </div>

        {/* The slider track */}
        <div style={styles.track}>
          <div style={styles.centerLine} />
          
          {/* Active tilt range */}
          {tilt !== 0 && (
            <div 
              style={{
                ...styles.activeRange,
                left: tilt < 0 ? `${50 + (tilt / 2)}%` : '50%',
                width: `${Math.abs(tilt) / 2}%`,
                backgroundColor: '#111113',
                boxShadow: '0 0 10px rgba(0, 0, 0, 0.1)',
              }} 
            />
          )}

          {/* Pointer indicator */}
          <div 
            style={{
              ...styles.pointer,
              left: `${pointerPosition}%`,
              backgroundColor: '#000000',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </div>

        <div style={styles.footer}>
          <div style={styles.metricItem}>
            <span style={styles.metricLabel}>Current imbalance</span>
            <span style={styles.metricVal}>{(imbalanceBps / 100).toFixed(2)}%</span>
          </div>
          <div style={styles.metricItem}>
            <span style={styles.metricLabel}>Dominant direction</span>
            <span style={{ ...styles.metricVal, color: '#000000' }}>
              {dominantLabel}
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
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
    marginTop: '-8px',
  },
  badge: {
    padding: '4px 14px',
    fontSize: '11px',
    fontWeight: '600',
    border: '1px solid',
    borderRadius: '100px',
  },
  axisContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    marginTop: '8px',
  },
  divisions: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
  },
  divisionText: {
    flex: '1',
    textAlign: 'center' as const,
    whiteSpace: 'nowrap' as const,
  },
  track: {
    position: 'relative' as const,
    height: '14px',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '100px',
    border: '1px solid var(--border-color)',
    margin: '10px 0',
    overflow: 'hidden',
  },
  centerLine: {
    position: 'absolute' as const,
    left: '50%',
    top: '0',
    bottom: '0',
    width: '2px',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    transform: 'translateX(-50%)',
    zIndex: 1,
  },
  activeRange: {
    position: 'absolute' as const,
    top: '0',
    bottom: '0',
    zIndex: 2,
    transition: 'all 0.3s ease-out',
  },
  pointer: {
    position: 'absolute' as const,
    top: '1px',
    width: '10px',
    height: '10px',
    borderRadius: '100px',
    transform: 'translateX(-50%)',
    zIndex: 3,
    transition: 'left 0.3s cubic-bezier(0.1, 0.8, 0.2, 1)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-color)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },
  metricItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: '500',
  },
  metricVal: {
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '13px',
  },
};
