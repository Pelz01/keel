import React, { useState } from 'react';

interface RecoveryVaultCardProps {
  recoveryBudget: number;
  userCredits: number;
  stableSymbol?: string;
}

export const RecoveryVaultCard: React.FC<RecoveryVaultCardProps> = ({
  recoveryBudget,
  userCredits,
  stableSymbol = 'USDG',
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'claim'>('status');

  return (
    <div style={styles.container} className="glass-panel">
      <div style={styles.header}>
        <span style={styles.title}>Recovery Vault</span>
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveTab('status')}
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === 'status' ? 'var(--container-bg)' : 'transparent',
              color: activeTab === 'status' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: activeTab === 'status' ? 'var(--border-color)' : 'transparent',
              boxShadow: activeTab === 'status' ? 'var(--shadow-button)' : 'none',
            }}
          >
            Recovery reserves
          </button>
          <button
            onClick={() => setActiveTab('claim')}
            style={{
              ...styles.tabButton,
              backgroundColor: activeTab === 'claim' ? 'var(--container-bg)' : 'transparent',
              color: activeTab === 'claim' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderColor: activeTab === 'claim' ? 'var(--border-color)' : 'transparent',
              boxShadow: activeTab === 'claim' ? 'var(--shadow-button)' : 'none',
            }}
          >
            Claimable credits
          </button>
        </div>
      </div>

      {activeTab === 'status' ? (
        <div style={styles.tabContent}>
          <div style={styles.topCardsRow}>
            <div style={styles.vaultMetric}>
              <span style={styles.metricLabel}>Total Recovery Budget</span>
              <span style={{ ...styles.metricVal, color: 'var(--text-primary)' }}>
                {recoveryBudget.toFixed(6)} {stableSymbol}
              </span>
            </div>

            <div style={styles.vaultMetric}>
              <span style={styles.metricLabel}>Your earned credits</span>
              <span style={{ ...styles.metricVal, color: 'var(--text-primary)' }}>
                {userCredits.toFixed(6)} {stableSymbol}
              </span>
            </div>
          </div>

          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Pool</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Recovery budget</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Your credits</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        OKB / {stableSymbol}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {recoveryBudget.toFixed(6)} {stableSymbol}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {userCredits.toFixed(6)} {stableSymbol}
                    </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={styles.explanationBox}>
            <span style={styles.boxHeader}>Recovery Mechanism</span>
            <p style={styles.boxText}>
              Toxic swaps deposit dynamic drag into the recovery vault. 
              Healing swaps that restore pool balance earn credits from those reserves.
            </p>
          </div>
        </div>
      ) : (
        <div style={styles.tabContent}>
          <div style={styles.explanationBox}>
            <span style={styles.boxHeader}>Credits recorded onchain</span>
            <p style={styles.boxText}>
              This build records recovery credits in the RecoveryVault. Token claiming is not enabled yet,
              so no claim transaction is exposed in the app.
            </p>
          </div>
        </div>
      )}
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
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '16px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    backgroundColor: 'var(--container-bg-hover)',
    padding: '3px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
  },
  tabButton: {
    border: '1px solid transparent',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    borderRadius: '6px',
    transition: 'var(--transition-smooth)',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  topCardsRow: {
    display: 'flex',
    gap: '12px',
  },
  vaultMetric: {
    flex: 1,
    backgroundColor: 'var(--container-bg-hover)',
    padding: '14px 16px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  metricLabel: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  metricVal: {
    fontSize: '16px',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
  },
  tableContainer: {
    backgroundColor: 'var(--container-bg)',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  th: {
    padding: '12px 16px',
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textAlign: 'left' as const,
    backgroundColor: 'var(--container-bg-hover)',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  explanationBox: {
    backgroundColor: 'var(--container-bg)',
    padding: '16px 20px',
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--border-color)',
    borderLeft: '3px solid var(--text-primary)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  boxHeader: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  boxText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
  },
  claimForm: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  claimLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  formLabel: {
    fontWeight: '500',
  },
  formLabelVal: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
  },
  inputWrapper: {
    display: 'flex',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--container-bg)',
    padding: '12px 16px',
    alignItems: 'center',
    transition: 'var(--transition-smooth)',
  },
  formInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '18px',
    fontWeight: '600',
  },
  maxButton: {
    backgroundColor: 'var(--container-bg-hover)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--text-primary)',
    padding: '6px 12px',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    fontWeight: '600',
    transition: 'var(--transition-smooth)',
  },
  claimSubmitButton: {
    padding: '16px',
    border: 'none',
    borderRadius: 'var(--border-radius-md)',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'var(--transition-smooth)',
  },
};
