import React, { useState } from 'react';

export interface HookEvent {
  id: string;
  name: string;
  timestamp: string;
  txHash: string;
  data: Record<string, string | number | boolean>;
}

interface OnchainProofProps {
  events: HookEvent[];
  hookAddress: string;
  vaultAddress: string;
  managerAddress: string;
  poolId: string;
  explorerBaseUrl?: string;
}

type EventFilter = 'All' | 'FlowUpdated' | 'SwapClassified' | 'StabilizationApplied' | 'RecoveryCredited';

export const OnchainProof: React.FC<OnchainProofProps> = ({
  events,
  hookAddress,
  vaultAddress,
  managerAddress,
  poolId,
  explorerBaseUrl = 'https://www.okx.com/web3/explorer/xlayer',
}) => {
  const [activeFilter, setActiveFilter] = useState<EventFilter>('All');

  const truncateAddr = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 8)}...${addr.substring(addr.length - 6)}`;
  };

  const getEventBadgeStyles = (name: string, data: Record<string, string | number | boolean>) => {
    if (name === 'SwapClassified' || name === 'StabilizationApplied') {
      const cls = data.tradeClass || data.classLabel;
      if (cls === 'Toxic' || cls === 2 || cls === '2') {
        return { borderColor: '#E11D48', color: '#FFFFFF', backgroundColor: '#E11D48' }; // Changed to aggressive red for toxic
      }
      if (cls === 'Healing' || cls === 1 || cls === '1') {
        return { borderColor: '#10B981', color: '#FFFFFF', backgroundColor: '#10B981' }; // Changed to green for healing
      }
    }
    return { borderColor: 'var(--border-color)', color: 'var(--text-secondary)', backgroundColor: 'transparent' };
  };

  const filteredEvents = events.filter(e => activeFilter === 'All' || e.name === activeFilter);

  const formatDataValue = (key: string, val: string | number | boolean) => {
    if (typeof val === 'number') {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('fee') || lowerKey.includes('surcharge') || lowerKey.includes('discount')) {
        return `${(val / 10000).toFixed(2)}%`;
      }
      if (lowerKey.includes('imbalance')) {
        return `${(val / 100).toFixed(2)}%`;
      }
    }
    return String(val);
  };

  return (
    <div style={styles.container} className="glass-panel">
      <div style={styles.header}>
        <span style={styles.title}>Onchain event explorer</span>
        <span style={styles.subtitle}>Verifiable event logs and contract registry</span>
      </div>

      {/* Contract Registry Grid */}
      <div className="registry" style={styles.registry}>
        <div style={styles.registryItem}>
          <span style={styles.registryLabel}>Hook contract</span>
          <a href={`${explorerBaseUrl}/address/${hookAddress}`} target="_blank" rel="noreferrer" style={styles.registryLink} title={hookAddress}>
            {truncateAddr(hookAddress)}
            <ExternalLinkIcon />
          </a>
        </div>
        <div style={styles.registryItem}>
          <span style={styles.registryLabel}>Recovery vault</span>
          <a href={`${explorerBaseUrl}/address/${vaultAddress}`} target="_blank" rel="noreferrer" style={styles.registryLink} title={vaultAddress}>
            {truncateAddr(vaultAddress)}
            <ExternalLinkIcon />
          </a>
        </div>
        <div style={styles.registryItem}>
          <span style={styles.registryLabel}>Pool manager</span>
          <a href={`${explorerBaseUrl}/address/${managerAddress}`} target="_blank" rel="noreferrer" style={styles.registryLink} title={managerAddress}>
            {truncateAddr(managerAddress)}
            <ExternalLinkIcon />
          </a>
        </div>
        <div style={styles.registryItem}>
          <span style={styles.registryLabel}>Active pool ID</span>
          <span style={styles.registryLink} title={poolId}>
            {truncateAddr(poolId)}
          </span>
        </div>
      </div>

      {/* Event Console */}
      <div style={styles.consoleContainer}>
        <div style={styles.consoleHeader}>
          <span style={styles.consoleTitle}>Live Hook Event Stream</span>
          <div style={styles.filters}>
            {['All', 'FlowUpdated', 'SwapClassified', 'StabilizationApplied', 'RecoveryCredited'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter as EventFilter)}
                style={{
                  ...styles.filterButton,
                  backgroundColor: activeFilter === filter ? 'var(--text-primary)' : 'transparent',
                  color: activeFilter === filter ? 'var(--container-bg)' : 'var(--text-secondary)',
                  borderColor: activeFilter === filter ? 'var(--text-primary)' : 'transparent',
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.logsList}>
          {filteredEvents.length === 0 ? (
            <div style={styles.emptyLogs}>
              <span>No transactions recorded for this filter.</span>
            </div>
          ) : (
            [...filteredEvents].reverse().map((event) => {
              const badgeStyle = getEventBadgeStyles(event.name, event.data);
              return (
                <div key={event.id} style={styles.logCard}>
                  <div style={styles.logHeader}>
                    <div style={styles.logNameWrapper}>
                      <span 
                        style={{
                          ...styles.logBadge,
                          ...badgeStyle
                        }}
                      >
                        {event.name}
                      </span>
                      <span style={styles.logTx}>
                        Tx: <a href={`${explorerBaseUrl}/tx/${event.txHash}`} target="_blank" rel="noreferrer" style={styles.txLink}>{truncateAddr(event.txHash)}</a>
                      </span>
                    </div>
                    <span style={styles.logTime}>{event.timestamp}</span>
                  </div>

                  <div className="log-data" style={styles.logData}>
                    {Object.entries(event.data).map(([key, val]) => (
                      <div key={key} style={styles.dataRow}>
                        <span style={styles.dataKey}>{key}:</span>
                        <span style={{
                          ...styles.dataVal,
                          fontWeight: (key === 'finalFee' || key === 'tradeClass' || key === 'recoveryCreditEarned') ? '700' : 'normal',
                          color: key === 'finalFee' ? 'var(--text-primary)' : 'inherit'
                        }}>
                          {formatDataValue(key, val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const ExternalLinkIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const styles = {
  container: {
    padding: '28px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  header: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  registry: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '20px',
  },
  registryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    backgroundColor: 'var(--container-bg)',
    padding: '12px 16px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.01)',
  },
  registryLabel: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: '500',
  },
  registryLink: {
    color: 'var(--text-primary)',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  consoleContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  consoleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    padding: '0 4px',
  },
  consoleTitle: {
    color: 'var(--text-primary)',
    fontWeight: '600',
  },
  filters: {
    display: 'flex',
    gap: '4px',
    backgroundColor: 'var(--container-bg-hover)',
    padding: '3px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  filterButton: {
    border: '1px solid transparent',
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    borderRadius: '4px',
    transition: 'var(--transition-smooth)',
  },
  logsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    maxHeight: '400px',
    overflowY: 'auto' as const,
    backgroundColor: 'var(--container-bg)',
    padding: '20px',
    borderRadius: 'var(--border-radius-lg)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-premium)',
  },
  emptyLogs: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
  logCard: {
    borderLeft: '3px solid var(--text-primary)',
    paddingLeft: '16px',
    paddingBottom: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logNameWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logBadge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '2px 8px',
    border: '1px solid',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono)',
  },
  logTx: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  txLink: {
    color: 'inherit',
    textDecoration: 'underline',
  },
  logTime: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  logData: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px 16px',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    padding: '10px 14px',
    borderRadius: 'var(--border-radius-sm)',
    backgroundColor: 'var(--container-bg-hover)',
    border: '1px solid var(--border-color)',
  },
  dataRow: {
    display: 'flex',
    gap: '6px',
  },
  dataKey: {
    color: 'var(--text-secondary)',
  },
  dataVal: {
    color: 'inherit',
    wordBreak: 'break-all' as const,
  },
};
