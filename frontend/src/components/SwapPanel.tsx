import React, { useState } from 'react';
import type { FeeBreakdown } from '../utils/keelLogic';

interface SwapPanelProps {
  preview: FeeBreakdown;
  zeroForOne: boolean;
  setZeroForOne: (val: boolean) => void;
  amount: string;
  setAmount: (val: string) => void;
  onSwap: () => Promise<void> | void;
  isConnected: boolean;
  onConnectWallet: () => void;
  stableSymbol: string;
  onStableSymbolChange: (val: string) => void;
  okbBalance: number;
  stableBalance: number;
  okbPrice: number;
}

export const SwapPanel: React.FC<SwapPanelProps> = ({
  preview,
  zeroForOne,
  setZeroForOne,
  amount,
  setAmount,
  onSwap,
  isConnected,
  onConnectWallet,
  stableSymbol,
  onStableSymbolChange,
  okbBalance,
  stableBalance,
  okbPrice,
}) => {
  const [showStableDropdown, setShowStableDropdown] = useState(false);
  const [swapState, setSwapState] = useState<'idle' | 'swapping' | 'success'>('idle');
  const liveStableSymbols = new Set(['USDG']);

  const handleSwapClick = async () => {
    if (parsedAmount <= 0) return;
    setSwapState('swapping');

    try {
      await onSwap();
      setSwapState('success');
      setTimeout(() => {
        setSwapState('idle');
      }, 1500);
    } catch {
      setSwapState('idle');
    }
  };

  const formatPercent = (val: number) => {
    return `${(val / 10000).toFixed(2)}%`;
  };

  const parsedAmount = parseFloat(amount) || 0;
  
  // Calculate output amount: input amount converted then minus effective fee
  const finalFeeRate = preview.finalFee / 1000000; // fee is in millionths (e.g. 3000 = 0.3%)
  const conversionRate = zeroForOne ? okbPrice : 1 / okbPrice;
  const outputAmountVal = parsedAmount > 0 ? parsedAmount * conversionRate * (1 - finalFeeRate) : 0;
  const outputAmount = parsedAmount > 0 ? outputAmountVal.toFixed(4) : '';

  const surchargeVal = (parsedAmount * preview.toxicSurcharge) / 1000000;
  const discountVal = (parsedAmount * conversionRate * preview.healingDiscount) / 1000000;

  const inputToken = zeroForOne ? 'OKB' : stableSymbol;
  const outputToken = zeroForOne ? stableSymbol : 'OKB';

  const inputUsdValue = zeroForOne ? parsedAmount * okbPrice : parsedAmount;
  const outputUsdValue = zeroForOne ? outputAmountVal : outputAmountVal * okbPrice;

  // Map of real CDN token logo images from CoinGecko
  const TOKEN_IMAGES: Record<string, string> = {
    OKB: 'https://coin-images.coingecko.com/coins/images/4463/small/WeChat_Image_20220118095654.png?1696505053',
    USDT: 'https://coin-images.coingecko.com/coins/images/325/small/Tether.png?1696501661',
    USDC: 'https://coin-images.coingecko.com/coins/images/6319/small/USDC.png?1769615602',
    USDG: 'https://coin-images.coingecko.com/coins/images/51281/small/GDN_USDG_Token_200x200.png?1730484111',
  };

  const TokenLogo = ({ symbol }: { symbol: string }) => {
    const url = TOKEN_IMAGES[symbol];
    if (url) {
      return (
        <img 
          src={url} 
          alt={`${symbol} logo`} 
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-color)',
            objectFit: 'contain',
            flexShrink: 0,
            display: 'block',
          }}
        />
      );
    }
    // Fallback if symbol matches nothing
    return (
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#E4E4E7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9px',
        fontWeight: 'bold',
        color: '#71717A',
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}>
        {symbol.slice(0, 3)}
      </div>
    );
  };

  const getFlowClassColor = () => {
    if (preview.tradeClass === 'Toxic') return '#D4FF00';
    if (preview.tradeClass === 'Healing') return '#0052FF';
    return '#5E616C';
  };

  // Helper to render static OKB or interactive stable token selector
  const RenderTokenSelector = ({ isStable }: { isStable: boolean }) => {
    if (!isStable) {
      return (
        <div style={styles.tokenSelector}>
          <TokenLogo symbol="OKB" />
          <span style={styles.tokenName}>OKB</span>
        </div>
      );
    }

    return (
      <div 
        onClick={() => setShowStableDropdown(!showStableDropdown)}
        style={styles.tokenSelectorInteractive}
      >
        <TokenLogo symbol={stableSymbol} />
        <span style={styles.tokenName}>{stableSymbol}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{
          transform: showStableDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s ease',
          flexShrink: 0,
        }}>
          <path d="M6 9l6 6 6-6" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {showStableDropdown && (
          <div style={styles.customTokenDropdown}>
            {(['USDG', 'USDC', 'USDT'] as const).map((sym) => {
              const isLive = liveStableSymbols.has(sym);
              return (
              <div 
                key={sym} 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isLive) return;
                  onStableSymbolChange(sym);
                  setShowStableDropdown(false);
                }}
                className="token-dropdown-item"
                style={{
                  ...styles.dropdownItem,
                  backgroundColor: stableSymbol === sym ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                  opacity: isLive ? 1 : 0.48,
                  cursor: isLive ? 'pointer' : 'not-allowed',
                }}
                title={isLive ? `${sym} live` : `${sym} pool coming soon`}
              >
                <TokenLogo symbol={sym} />
                <span style={styles.dropdownItemText}>{sym}</span>
                {!isLive && <span style={styles.comingSoonText}>Soon</span>}
              </div>
            )})}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ ...styles.swapCard, position: 'relative' }}>
      {/* Header */}
      <div style={styles.cardHeader}>
        <span style={styles.cardTitle}>Swap</span>
        <div style={styles.statusBadge}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span style={{ ...styles.statusLabel, color: 'var(--text-secondary)' }}>Protected by KEEL</span>
        </div>
      </div>

      {/* Input / Output container */}
      <div style={styles.inputsContainer}>
        {/* You Pay Panel */}
        <div style={styles.tokenInputPanel}>
          <div style={styles.panelLabelRow}>
            <span style={styles.panelTitle}>You pay</span>
            <span style={styles.balanceText}>
              {isConnected 
                ? `Balance: ${(zeroForOne ? okbBalance : stableBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` 
                : 'Balance: 0.00'}
            </span>
          </div>
          <div style={styles.inputRow}>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              disabled={swapState === 'swapping'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^[0-9]*[.,]?[0-9]*$/.test(val)) {
                  setAmount(val.replace(',', '.'));
                }
              }}
              style={{ ...styles.amountInput, opacity: swapState === 'swapping' ? 0.6 : 1 }}
            />
            <RenderTokenSelector isStable={!zeroForOne} />
          </div>
          <div style={styles.usdValueRow}>
            <span>{parsedAmount > 0 ? `$${inputUsdValue.toFixed(2)}` : '$0.00'}</span>
          </div>
        </div>

        {/* Switch Direction Button */}
        <div style={styles.switchButtonWrapper}>
          <button onClick={() => setZeroForOne(!zeroForOne)} style={styles.switchButton} title="Switch directions">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* You Receive Panel */}
        <div style={styles.tokenInputPanel}>
          <div style={styles.panelLabelRow}>
            <span style={styles.panelTitle}>You receive</span>
            <span style={styles.balanceText}>
              {isConnected 
                ? `Balance: ${(zeroForOne ? stableBalance : okbBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` 
                : 'Balance: 0.00'}
            </span>
          </div>
          <div style={styles.inputRow}>
            <input
              type="text"
              placeholder="0"
              value={outputAmount}
              readOnly
              style={styles.amountInput}
            />
            <RenderTokenSelector isStable={zeroForOne} />
          </div>
          <div style={styles.usdValueRow}>
            <span>{outputAmountVal > 0 ? `$${outputUsdValue.toFixed(2)}` : '$0.00'}</span>
          </div>
        </div>
      </div>

      {/* Persistent KEEL Classification Box */}
      {parsedAmount > 0 && (
        <div style={styles.detailsContainer}>
          <div style={styles.detailsHeaderRow}>
            <span style={styles.detailsTitle}>KEEL Classification</span>
          </div>

          <div style={styles.detailsContent}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Flow Class</span>
              <span style={{ ...styles.detailValue, fontWeight: '700', color: getFlowClassColor() }}>
                {preview.tradeClass}
              </span>
            </div>
            
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Base Fee</span>
              <span style={styles.detailValue}>{formatPercent(preview.baseFee)}</span>
            </div>
            
            {preview.tradeClass === 'Toxic' && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Dynamic Drag</span>
                <span style={{ ...styles.detailValue, color: '#E11D48' }}>+{formatPercent(preview.toxicSurcharge)}</span>
              </div>
            )}
            
            {preview.tradeClass === 'Healing' && discountVal > 0 && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Healing Discount</span>
                <span style={{ ...styles.detailValue, color: '#10B981' }}>-{formatPercent(preview.healingDiscount)}</span>
              </div>
            )}
            
            <div style={styles.divider} />
            
            <div style={styles.detailRow}>
              <span style={{ ...styles.detailLabel, fontWeight: '600', color: 'var(--text-primary)' }}>Final KEEL Fee</span>
              <span style={{ ...styles.detailValue, fontWeight: '700', color: 'var(--text-primary)' }}>
                {formatPercent(preview.finalFee)}
              </span>
            </div>

            {preview.tradeClass === 'Toxic' && surchargeVal > 0 && (
              <div style={styles.vaultNote}>
                <span>+{surchargeVal.toFixed(4)} {inputToken} added to Recovery Budget.</span>
              </div>
            )}
            {preview.tradeClass === 'Healing' && discountVal > 0 && (
              <div style={styles.vaultNote}>
                <span>+{discountVal.toFixed(4)} {outputToken} earned as Recovery Credit.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isConnected ? (
        <button onClick={onConnectWallet} style={styles.actionButton}>
          Connect wallet
        </button>
      ) : (
        <button
          onClick={handleSwapClick}
          disabled={parsedAmount <= 0 || swapState === 'swapping' || swapState === 'success'}
          style={{
            ...styles.actionButton,
            backgroundColor: swapState === 'success' ? '#10B981' : (swapState === 'swapping' ? 'var(--text-secondary)' : (parsedAmount > 0 ? 'var(--text-primary)' : 'var(--container-bg-hover)')),
            color: swapState === 'success' ? '#FFFFFF' : (parsedAmount > 0 ? 'var(--container-bg)' : 'var(--text-muted)'),
            cursor: parsedAmount > 0 && swapState === 'idle' ? 'pointer' : 'not-allowed',
          }}
        >
          {swapState === 'swapping' ? 'Confirming...' : swapState === 'success' ? 'Swap successful' : 'Swap tokens'}
        </button>
      )}
    </div>
  );
};

const styles = {
  swapCard: {
    width: '100%',
    maxWidth: '480px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '24px',
    padding: '16px',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    margin: '0 auto',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 8px 4px 8px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    padding: '4px 10px',
    borderRadius: '100px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '100px',
  },
  statusLabel: {
    fontSize: '11px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  inputsContainer: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  tokenInputPanel: {
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  panelLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  panelTitle: {
    fontWeight: '400',
  },
  balanceText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  inputRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  amountInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: '28px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    width: '60%',
  },
  tokenSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '100px',
    padding: '6px 12px 6px 10px',
    boxShadow: 'var(--shadow-button)',
  },
  tokenSvg: {
    flexShrink: 0,
  },
  tokenName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  usdValueRow: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
  switchButtonWrapper: {
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
  },
  switchButton: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    backgroundColor: 'var(--container-bg)',
    border: '4px solid var(--bg-color)',
    boxShadow: 'var(--shadow-button)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  detailsContainer: {
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  detailsHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--border-color)',
  },
  detailsTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  detailsContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    paddingTop: '4px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
  },
  detailLabel: {
    color: 'var(--text-secondary)',
  },
  detailValue: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  detailExplanation: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
    marginBottom: '4px',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '4px 0',
  },
  vaultNote: {
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  actionButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: 'var(--text-primary)',
    color: 'var(--container-bg)',
    border: 'none',
    borderRadius: '16px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: 'var(--shadow-button)',
  },
  tokenSelectorInteractive: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '100px',
    padding: '6px 12px 6px 10px',
    boxShadow: 'var(--shadow-button)',
    cursor: 'pointer',
    position: 'relative' as const,
    userSelect: 'none' as const,
  },
  customTokenDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 6px)',
    right: '0',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '6px',
    boxShadow: 'var(--shadow-card)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: '130px',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  dropdownItemText: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
  },
  comingSoonText: {
    marginLeft: 'auto',
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
  },
  successOverlay: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'var(--container-bg)',
    borderRadius: '24px',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center' as const,
  },
  successIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#0052FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 8px 24px rgba(0, 82, 255, 0.25)',
  },
  successTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  successMessage: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: '1.4',
  },
  txLink: {
    fontSize: '12px',
    color: '#0052FF',
    textDecoration: 'none',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '100px',
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    transition: 'all 0.15s ease',
  },
  doneBtn: {
    marginTop: '16px',
    padding: '10px 24px',
    backgroundColor: 'var(--text-primary)',
    color: 'var(--container-bg)',
    border: 'none',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    maxWidth: '100px',
    transition: 'all 0.15s ease',
  },
};
