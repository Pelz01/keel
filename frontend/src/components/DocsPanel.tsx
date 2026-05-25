import React, { useState } from 'react';

const CopyableCode: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(console.error);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div 
      style={{ 
        ...styles.inlineCode, 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        cursor: 'pointer',
        justifyContent: 'space-between'
      }} 
      onClick={handleCopy}
      title="Click to copy"
      onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--text-muted)')}
      onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
    >
      <span>{value}</span>
      <span style={{ fontSize: '11px', fontWeight: 'bold', color: copied ? '#27C93F' : 'var(--text-muted)' }}>
        {copied ? '✓' : 'Copy'}
      </span>
    </div>
  );
};

interface Article {
  id: string;
  title: string;
  category: string;
  content: React.ReactNode;
}

export const DocsPanel: React.FC = () => {
  const [activeArticleId, setActiveArticleId] = useState('intro');

  const articles: Article[] = [
    {
      id: 'intro',
      category: 'Getting Started',
      title: 'Introduction to Keel',
      content: (
        <div style={styles.articleBody}>
          <p style={styles.paragraph}>
            Keel is a self-stabilizing liquidity protocol built as a Uniswap v4 Hook. It protects liquidity providers (LPs) by making pools react dynamically to trading volume.
          </p>
          
          <div style={styles.infoBox}>
            <span style={styles.boxTitle}>Core thesis</span>
            <p style={styles.boxText}>
              Traditional pools bleed value when prices shift rapidly in one direction. Keel changes this: trades that move the pool out of balance pay a surcharge, which is immediately stored in a vault to reward trades that restore balance.
            </p>
          </div>

          <h3 style={styles.heading3}>The liquidity provider problem</h3>
          <p style={styles.paragraph}>
            When trading volume moves in a single direction, LPs end up holding the depreciating asset while their reserves of the demanded asset are drained. Arbitrageurs profit at the LPs' expense. Keel stops this by creating a counter-balancing economic incentive.
          </p>
        </div>
      ),
    },
    {
      id: 'mechanism',
      category: 'Core Concepts',
      title: 'The balancing loop',
      content: (
        <div style={styles.articleBody}>
          <p style={styles.paragraph}>
            Keel monitors the volume of trades in real time and classifies every swap into one of three categories:
          </p>

          <div style={styles.flowTypes}>
            <div style={styles.flowTypeItem}>
              <span style={styles.flowTypeBadge}>Toxic flow</span>
              <p style={styles.flowTypeDesc}>
                Any swap that increases the pool's directional imbalance. A dynamic surcharge is added to this trade to protect LP inventory.
              </p>
            </div>
            <div style={styles.flowTypeItem}>
              <span style={styles.flowTypeBadge}>Healing flow</span>
              <p style={styles.flowTypeDesc}>
                Any swap that decreases the pool's imbalance, returning it toward equilibrium. These trades receive fee discounts and recovery rewards.
              </p>
            </div>
            <div style={styles.flowTypeItem}>
              <span style={styles.flowTypeBadge}>Neutral flow</span>
              <p style={styles.flowTypeDesc}>
                Swaps executed when the pool is balanced. These trades execute at the standard base fee of 0.30%.
              </p>
            </div>
          </div>

          <div style={styles.infoBox}>
            <span style={styles.boxTitle}>Toxic flow funds corrective flow</span>
            <p style={styles.boxText}>
              Surcharges collected from toxic trades are automatically stored in the pool's Recovery Vault. This budget is then used to pay out rewards to healing trades, motivating arbitrageurs to balance the pool.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'fees',
      category: 'Core Concepts',
      title: 'Dynamic fee tiers',
      content: (
        <div style={styles.articleBody}>
          <p style={styles.paragraph}>
            Instead of standard static fees, Keel uses a dynamic fee curve that responds to the pool's balance state:
          </p>

          <table style={styles.table}>
            <thead>
              <tr style={styles.tr}>
                <th style={styles.th}>Fee type</th>
                <th style={styles.th}>Rate</th>
                <th style={styles.th}>Condition</th>
              </tr>
            </thead>
            <tbody>
              <tr style={styles.tr}>
                <td style={styles.td}>Minimum fee</td>
                <td style={styles.td}>0.05%</td>
                <td style={styles.td}>Applied to healing trades restoring equilibrium</td>
              </tr>
              <tr style={styles.tr}>
                <td style={styles.td}>Base fee</td>
                <td style={styles.td}>0.30%</td>
                <td style={styles.td}>Applied to neutral trades under normal conditions</td>
              </tr>
              <tr style={styles.tr}>
                <td style={styles.td}>Maximum fee</td>
                <td style={styles.td}>1.50%</td>
                <td style={styles.td}>Applied to toxic trades at extreme imbalance limits</td>
              </tr>
            </tbody>
          </table>

          <p style={styles.paragraph}>
            The dynamic surcharge scales linearly with the pool's imbalance metric, ensuring that trades causing larger disruptions pay progressively higher fees.
          </p>
        </div>
      ),
    },
    {
      id: 'v4-hooks',
      category: 'Technical Specs',
      title: 'Uniswap v4 integration',
      content: (
        <div style={styles.articleBody}>
          <p style={styles.paragraph}>
            Keel runs trustlessly onchain by hooking directly into the Uniswap v4 PoolManager lifecycle:
          </p>

          <h4 style={styles.heading4}>beforeSwap() hook</h4>
          <p style={styles.paragraph}>
            Runs prior to trade execution. It checks the swap direction, calculates the pool's active imbalance, computes the dynamic fee, and overrides the transaction fee.
          </p>

          <h4 style={styles.heading4}>afterSwap() hook</h4>
          <p style={styles.paragraph}>
            Runs post-swap. If the trade was toxic, it directs the surcharge to the Recovery Vault. If it was healing, it awards credits to the trader. It then updates the recorded directional volume.
          </p>

          <div style={styles.codeBlock}>
            {`// beforeSwap hook implementation snippet
function beforeSwap(
    address,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata
) external view override onlyManager returns (bytes4, BeforeSwapDelta, uint24) {
    bytes32 poolId = keccak256(abi.encode(key));
    FlowClassifierLib.FlowState memory flowState = poolFlowStates[poolId];

    (FlowClassifierLib.TradeClass tradeClass, uint256 imbalanceBps) = 
        flowState.classifySwap(params.zeroForOne, neutralThresholdBps);

    KeelFeeLib.FeeBreakdown memory breakdown = KeelFeeLib.calculateFee(
        tradeClass, imbalanceBps, baseFee, minFee, maxFee
    );

    return (IHooks.beforeSwap.selector, BeforeSwapDelta.wrap(0), OVERRIDE_FEE_FLAG | breakdown.finalFee);
}`}
          </div>
        </div>
      ),
    },
    {
      id: 'execution-model',
      category: 'Technical Specs',
      title: 'Execution model',
      content: (
        <div style={styles.articleBody}>
          <p style={styles.paragraph}>
            KEEL separates pre-swap estimation from confirmed onchain state.
            The frontend may estimate classifications before execution, but confirmed results are read from transaction receipts and deployed contracts.
          </p>
          <p style={styles.paragraph}>
            The live product is configured for the OKB / USDG protected pool on X Layer mainnet.
            OKB / USDC and OKB / USDT are displayed as coming soon.
          </p>
        </div>
      ),
    },
    {
      id: 'verification',
      category: 'Developer Reference',
      title: 'Onchain verification',
      content: (
        <div style={styles.articleBody}>
          <p style={styles.paragraph}>
            KEEL has been validated on X Layer testnet and repeated on X Layer mainnet with tiny real liquidity.
            The app reads confirmed pool state and Hook events from deployed contracts.
          </p>

          <h4 style={styles.heading4}>Mainnet deployment</h4>
          <div style={styles.registryList}>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Network</span>
              <code style={styles.inlineCode}>X Layer Mainnet</code>
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Pool</span>
              <code style={styles.inlineCode}>OKB / USDG</code>
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Pool ID</span>
              <CopyableCode value="0x33fb806466dd0ccc969aa38946b5df6f3bd0678662f018805a93492cd9ad84bc" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Neutral swap</span>
              <CopyableCode value="0xb4fa9fd93d92a7ccd44825ed3ebe500974eef96785e57a8c976c8091e9fbf3d3" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Toxic swap</span>
              <CopyableCode value="0xb2670d9ddea8d3f7aa9558b5a2571863f0ce0c33a56f1c246a35e0aed774d974" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Healing swap</span>
              <CopyableCode value="0xa139e06b9954087613620165fe78b453be4d57229710ae8a7e4bb74df8d4d00c" />
            </div>
          </div>

          <p style={styles.paragraph}>
            Full transaction lists and reproduction notes are maintained in the project README and proof files.
          </p>
        </div>
      ),
    },
    {
      id: 'registry',
      category: 'Developer Reference',
      title: 'Contract addresses',
      content: (
        <div style={styles.articleBody}>
          <p style={styles.paragraph}>
            Keel contracts are deployed on X Layer mainnet. Below are the registered addresses for verification:
          </p>

          <div style={styles.registryList}>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Hook contract</span>
              <CopyableCode value="0x5204E843a29DC984BaD071bD1b41780a9B2c90c0" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Recovery vault</span>
              <CopyableCode value="0xa70583b7CA9d283CF831dB22F40799c1BAAFC6eE" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>KeelLens</span>
              <CopyableCode value="0x97bC23509E80c41b57225D4Ac1131DCEBB8dA184" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Swap executor</span>
              <CopyableCode value="0x38900dacc1475e779e4213AEC064716e304e6Cb9" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Pool manager</span>
              <CopyableCode value="0x360e68faccca8ca495c1b759fd9eee466db9fb32" />
            </div>
            <div style={styles.registryItem}>
              <span style={styles.registryLabel}>Active pool ID</span>
              <CopyableCode value="0x33fb806466dd0ccc969aa38946b5df6f3bd0678662f018805a93492cd9ad84bc" />
            </div>
          </div>
        </div>
      ),
    },
  ];

  const activeArticle = articles.find((a) => a.id === activeArticleId) || articles[0];

  // Group articles by category
  const categories: Record<string, Article[]> = {};
  articles.forEach((a) => {
    if (!categories[a.category]) {
      categories[a.category] = [];
    }
    categories[a.category].push(a);
  });

  return (
    <div className="docs-container" style={styles.container}>
      {/* Gitbook Sidebar */}
      <aside className="docs-sidebar" style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>Documentation</span>
        </div>
        <nav style={styles.sidebarNav}>
          {Object.entries(categories).map(([catName, artList]) => (
            <div key={catName} style={styles.catGroup}>
              <span style={styles.catName}>{catName}</span>
              <ul style={styles.artList}>
                {artList.map((art) => (
                  <li key={art.id}>
                    <button
                      onClick={() => setActiveArticleId(art.id)}
                      style={{
                        ...styles.artButton,
                        fontWeight: activeArticleId === art.id ? '600' : '400',
                        color: activeArticleId === art.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                        backgroundColor: activeArticleId === art.id ? 'var(--bg-color)' : 'transparent',
                      }}
                    >
                      {art.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Documentation Viewer */}
      <main className="docs-content" style={styles.content}>
        <div style={styles.contentHeader}>
          <span style={styles.contentCategory}>{activeArticle.category}</span>
          <h2 style={styles.contentTitle}>{activeArticle.title}</h2>
        </div>
        <div style={styles.divider} />
        {activeArticle.content}
      </main>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    width: '100%',
    minHeight: '600px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-premium)',
  },
  sidebar: {
    width: '260px',
    borderRight: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-color)',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    flexShrink: 0,
  },
  sidebarHeader: {
    paddingLeft: '8px',
  },
  sidebarTitle: {
    fontSize: '11px',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    color: 'var(--text-muted)',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  catGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  catName: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    color: 'var(--text-muted)',
    paddingLeft: '8px',
    letterSpacing: '0.5px',
  },
  artList: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  artButton: {
    width: '100%',
    textAlign: 'left' as const,
    padding: '8px 12px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    transition: 'all 0.15s ease',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    ':hover': {
      backgroundColor: 'var(--container-bg-hover)',
      color: 'var(--text-primary)',
    },
  },
  content: {
    flex: 1,
    padding: '48px',
    overflowY: 'auto' as const,
    backgroundColor: 'var(--container-bg)',
  },
  contentHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  contentCategory: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  contentTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '24px 0 32px 0',
  },
  articleBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    maxWidth: '720px',
  },
  paragraph: {
    fontSize: '15px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
  },
  heading3: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginTop: '16px',
  },
  heading4: {
    fontSize: '15px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginTop: '12px',
  },
  infoBox: {
    backgroundColor: 'var(--bg-color)',
    borderLeft: '4px solid var(--text-primary)',
    padding: '16px 20px',
    borderRadius: '0 8px 8px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    marginTop: '8px',
  },
  boxTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  boxText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  flowTypes: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    margin: '8px 0',
  },
  flowTypeItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
  },
  flowTypeBadge: {
    width: '90px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: '700',
    textAlign: 'center' as const,
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-primary)',
    flexShrink: 0,
  },
  flowTypeDesc: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
    margin: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    margin: '12px 0',
    fontSize: '13.5px',
  },
  tr: {
    borderBottom: '1px solid var(--border-color)',
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px 16px',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    backgroundColor: 'var(--bg-color)',
  },
  td: {
    padding: '12px 16px',
    color: 'var(--text-secondary)',
  },
  codeBlock: {
    backgroundColor: '#0D0E12',
    color: '#FAFAFC',
    padding: '20px',
    borderRadius: '12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12.5px',
    lineHeight: '1.5',
    overflowX: 'auto' as const,
    whiteSpace: 'pre' as const,
    marginTop: '8px',
  },
  registryList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    marginTop: '8px',
  },
  registryItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  registryLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  inlineCode: {
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--bg-color)',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    width: 'fit-content',
    color: 'var(--text-primary)',
  },
};
