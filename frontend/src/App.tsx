import { useState, useMemo, useEffect } from 'react';
import { ethers } from 'ethers';
import { KeelAxis } from './components/KeelAxis';
import { SwapPanel } from './components/SwapPanel';
import { SwapContextSidebar } from './components/SwapContextSidebar';
import { PoolHealthCard } from './components/PoolHealthCard';
import { RecoveryVaultCard } from './components/RecoveryVaultCard';
import { OnchainProof } from './components/OnchainProof';
import type { HookEvent } from './components/OnchainProof';
import { classifySwap, calculateFee, calculateImbalance } from './utils/keelLogic';
import type { FeeBreakdown } from './utils/keelLogic';
import { readPoolSummaryOnchain, readTraderCreditsOnchain, readNativeBalance, readERC20Balance, executeSwapOnchain, fetchKeelLogsOnchain, parseHookLog } from './utils/web3Connection';

// Declare Web3 injected wallet interfaces to avoid TypeScript errors
declare global {
  interface Window {
    ethereum?: any;
    okxwallet?: any;
  }
}

type AppSubPage = 'swap' | 'pools' | 'vault' | 'logs';

async function waitForWalletReceipt(provider: any, txHash: string) {
  for (let i = 0; i < 60; i++) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt) {
      if (receipt.status && receipt.status !== '0x1') {
        throw new Error(`Transaction reverted: ${txHash}`);
      }
      return receipt;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out waiting for transaction receipt: ${txHash}`);
}

export default function App() {
  // Navigation states using hash-routing
  const [currentPage, setCurrentPage] = useState<'landing' | 'app'>('landing');
  const [appSubPage, setAppSubPage] = useState<AppSubPage>('swap');

  // Wallet Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [rawWalletAddress, setRawWalletAddress] = useState<string>('');
  const [okbBalance, setOkbBalance] = useState<number>(0);
  const [stableBalance, setStableBalance] = useState<number>(0);
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleWalletClick = () => {
    if (!isConnected) {
      handleConnectWallet();
    } else {
      setShowWalletDropdown(!showWalletDropdown);
    }
  };

  const STABLE_ADDRESSES: Record<string, string> = {
    USDT: import.meta.env.VITE_KEEL_USDT_ADDRESS || '0x1e4a5963abfd975d8c9021ce480b42188849d41d',
    USDC: import.meta.env.VITE_KEEL_USDC_ADDRESS || '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
    USDG: import.meta.env.VITE_KEEL_USDG_ADDRESS || '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
  };

  const refreshBalances = async (provider: any, address: string, activeStable: string) => {
    try {
      const okbVal = await readNativeBalance(provider, address);
      setOkbBalance(okbVal);

      const stableAddr = STABLE_ADDRESSES[activeStable];
      if (stableAddr) {
        const stableVal = await readERC20Balance(provider, stableAddr, address, 6);
        setStableBalance(stableVal);
      }
    } catch (err) {
      console.warn('Failed to refresh balances:', err);
    }
  };

  // Pool state (Polled directly from X Layer contracts)
  const [token0Vol, setToken0Vol] = useState(0);
  const [token1Vol, setToken1Vol] = useState(0);
  const [recoveryBudget, setRecoveryBudget] = useState(0);
  const [userCredits, setUserCredits] = useState(0);
  const [events, setEvents] = useState<HookEvent[]>([]);
  const [eventSource, setEventSource] = useState<'recent' | 'verified'>('recent');
  const [poolReadError, setPoolReadError] = useState<string | null>(null);

  // Swap input state
  const [amount, setAmount] = useState('0.001');
  const [zeroForOne, setZeroForOne] = useState(true);
  const [stableSymbol, setStableSymbol] = useState<string>('USDG');
  const [okbPrice, setOkbPrice] = useState(43.25);

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('keel-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };



  // Constants
  const baseFee = 3000; // 0.30%
  const minFee = 500; // 0.05%
  const maxFee = 15000; // 1.50%
  const neutralThreshold = 1500; // 15%

  const hookAddress = import.meta.env.VITE_KEEL_HOOK_ADDRESS || '0x5204E843a29DC984BaD071bD1b41780a9B2c90c0';
  const vaultAddress = import.meta.env.VITE_KEEL_VAULT_ADDRESS || '0xa70583b7CA9d283CF831dB22F40799c1BAAFC6eE';
  const managerAddress = import.meta.env.VITE_KEEL_MANAGER_ADDRESS || '0x360e68faccca8ca495c1b759fd9eee466db9fb32';
  const lensAddress = import.meta.env.VITE_KEEL_LENS_ADDRESS || '0x97bC23509E80c41b57225D4Ac1131DCEBB8dA184';
  const poolId = import.meta.env.VITE_KEEL_POOL_ID || '0x33fb806466dd0ccc969aa38946b5df6f3bd0678662f018805a93492cd9ad84bc';
  const executorAddress = import.meta.env.VITE_KEEL_EXECUTOR_ADDRESS || '0x38900dacc1475e779e4213AEC064716e304e6Cb9';
  const okbStablePoolReady = (import.meta.env.VITE_KEEL_OKB_STABLE_POOL_READY ?? 'true') === 'true';
  const expectedChainId = import.meta.env.VITE_KEEL_CHAIN_ID || '0xc4';
  const publicRpcUrl = import.meta.env.VITE_KEEL_PUBLIC_RPC_URL || 'https://rpc.xlayer.tech';
  const explorerBaseUrl = import.meta.env.VITE_KEEL_EXPLORER_BASE_URL || 'https://www.okx.com/web3/explorer/xlayer';

  const publicReadProvider = useMemo(() => ({
    request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      const response = await fetch(publicRpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params: params || [],
        }),
      });
      const payload = await response.json();
      if (payload.error) {
        throw new Error(payload.error.message || `RPC error while calling ${method}`);
      }
      return payload.result;
    },
  }), [publicRpcUrl]);

  // Hash-routing listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/app/')) {
        const sub = hash.replace('#/app/', '') as AppSubPage;
        setCurrentPage('app');
        setAppSubPage(sub);
      } else if (hash === '#/app' || hash === '#/swap') {
        setCurrentPage('app');
        setAppSubPage('swap');
      } else {
        setCurrentPage('landing');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Run once on load

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch live OKB price from CoinGecko simple price endpoint
  useEffect(() => {
    const fetchOkbPrice = async () => {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=okb&vs_currencies=usd');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        if (data && data.okb && typeof data.okb.usd === 'number') {
          setOkbPrice(data.okb.usd);
        }
      } catch (err) {
        console.warn('Failed to fetch live OKB price, using default:', err);
      }
    };
    fetchOkbPrice();
    const interval = setInterval(fetchOkbPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const navigateToLanding = () => {
    window.location.hash = '#/';
  };

  const navigateToApp = (tab: AppSubPage) => {
    window.location.hash = `#/app/${tab}`;
    window.scrollTo(0, 0);
  };

  // Derived state
  const imbalanceBps = useMemo(() => {
    return calculateImbalance(token0Vol, token1Vol);
  }, [token0Vol, token1Vol]);

  const preview: FeeBreakdown = useMemo(() => {
    const { tradeClass, imbalanceBps: currentImbalance } = classifySwap(
      token0Vol,
      token1Vol,
      zeroForOne,
      neutralThreshold
    );
    return calculateFee(tradeClass, currentImbalance, baseFee, minFee, maxFee);
  }, [token0Vol, token1Vol, zeroForOne]);





  const handleSwap = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (isConnected && rawWalletAddress) {
      const provider = window.okxwallet || window.ethereum;
      if (provider) {
        try {
          const chainId = await provider.request({ method: 'eth_chainId' });
          if (expectedChainId && chainId?.toLowerCase() !== expectedChainId.toLowerCase()) {
            console.error('Wrong network:', chainId);
            showToast(`Please switch your wallet to X Layer ${expectedChainId === '0x7a0' ? 'testnet' : 'mainnet'} before swapping.`);
            return;
          }
          if (!okbStablePoolReady) {
            showToast('The OKB / USDG protected pool is not configured for live swaps in this build.');
            return;
          }

          const uniswapZeroForOne = zeroForOne;
          
          const NATIVE_OKB = "0x0000000000000000000000000000000000000000";
          const stableTokenAddress = STABLE_ADDRESSES[stableSymbol];
          const DYNAMIC_FEE_FLAG = 0x800000;
          
          const tokenIn = zeroForOne ? NATIVE_OKB : stableTokenAddress;
          const decimals = zeroForOne ? 18 : 6;
          const amountSpecified = ethers.parseUnits(parsedAmount.toString(), decimals);

          if (!zeroForOne) {
            const erc20Iface = new ethers.Interface([
              "function allowance(address owner, address spender) external view returns (uint256)",
              "function approve(address spender, uint256 amount) external returns (bool)"
            ]);
            
            const allowanceData = erc20Iface.encodeFunctionData("allowance", [rawWalletAddress, executorAddress]);
            const allowanceRes = await provider.request({
              method: 'eth_call',
              params: [{ to: tokenIn, data: allowanceData }, 'latest']
            });
            
            if (allowanceRes === '0x' || BigInt(allowanceRes) < amountSpecified) {
              const approveData = erc20Iface.encodeFunctionData("approve", [executorAddress, ethers.MaxUint256]);
              const approveHash = await provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: rawWalletAddress, to: tokenIn, data: approveData }]
              });
              await waitForWalletReceipt(provider, approveHash);
            }
          }

          const poolKey = {
            currency0: NATIVE_OKB,
            currency1: stableTokenAddress,
            fee: DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: hookAddress
          };

          const MIN_SQRT_PRICE_LIMIT = "4295128740";
          const MAX_SQRT_PRICE_LIMIT = "1461446703485210103287273052203988822378723970341";

          const swapParams = {
            zeroForOne: uniswapZeroForOne,
            amountSpecified: "-" + amountSpecified.toString(),
            sqrtPriceLimitX96: uniswapZeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT
          };

          const txValue = zeroForOne ? ethers.toBeHex(amountSpecified) : "0x0";
          const receipt = await executeSwapOnchain(provider, rawWalletAddress, executorAddress, poolKey, swapParams, "0x", txValue);
          const confirmedEvents: HookEvent[] = [];
          for (const log of receipt.logs) {
            if (log.address?.toLowerCase() !== hookAddress.toLowerCase()) continue;
            const parsedLog = parseHookLog(log);
            if (parsedLog) confirmedEvents.push(parsedLog as unknown as HookEvent);
          }

          if (confirmedEvents.length > 0) {
            setEvents((prev) => [...prev, ...confirmedEvents]);
          }

          await syncOnchainState(provider, rawWalletAddress);
          
          setAmount('');
        } catch (err) {
          console.error("Swap error:", err);
          showToast("Swap execution failed. Please check your wallet.");
          throw err;
        }
      }
    } else {
      showToast("Please connect a wallet to execute a real swap.");
    }

  };

  // Poll real onchain state
  useEffect(() => {
    let active = true;
    const walletProvider = typeof window !== 'undefined' ? (window.okxwallet || window.ethereum) : null;

    const poll = async () => {
      try {
        const summary = await readPoolSummaryOnchain(publicReadProvider, lensAddress, hookAddress, poolId);
        if (active && summary) {
          setToken0Vol(summary.token0Volume);
          setToken1Vol(summary.token1Volume);
          setRecoveryBudget(summary.recoveryBudget);
          setPoolReadError(null);
        } else if (active) {
          setPoolReadError('Pool state read returned empty data.');
        }

        if (active && isConnected && rawWalletAddress && walletProvider) {
          const credits = await readTraderCreditsOnchain(publicReadProvider, lensAddress, hookAddress, poolId, rawWalletAddress);
          if (credits !== null) setUserCredits(credits);
        }

        const logResult = await fetchKeelLogsOnchain(publicReadProvider, hookAddress, poolId);
        if (active) setEventSource(logResult.source);
        if (active && logResult.events.length > 0) {
          // Only update if logs changed to avoid unneeded re-renders
          setEvents((prev) => {
            if (prev.length === logResult.events.length) return prev;
            return logResult.events;
          });
        }
      } catch (err) {
        console.warn("Polling failed:", err);
        if (active) setPoolReadError('State read failed. Check X Layer RPC connectivity.');
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [isConnected, rawWalletAddress, poolId, publicReadProvider]);


  // Reset pool state when changing stables to make it feel responsive
  useEffect(() => {
    // Refresh balances if connected
    const provider = typeof window !== 'undefined' ? (window.okxwallet || window.ethereum) : null;
    if (isConnected) {
      if (rawWalletAddress && provider) {
        refreshBalances(provider, rawWalletAddress, stableSymbol);
      }
    }
  }, [stableSymbol]);

  // Sync onchain state manually on connect
  const syncOnchainState = async (provider: any, userAddress?: string) => {
    try {
      const summary = await readPoolSummaryOnchain(publicReadProvider, lensAddress, hookAddress, poolId);
      if (summary) {
        setToken0Vol(summary.token0Volume);
        setToken1Vol(summary.token1Volume);
        setRecoveryBudget(summary.recoveryBudget);
        setPoolReadError(null);
      } else {
        setPoolReadError('Pool state read returned empty data.');
      }
      
      if (userAddress) {
        const credits = await readTraderCreditsOnchain(publicReadProvider, lensAddress, hookAddress, poolId, userAddress);
        if (credits !== null) {
          setUserCredits(credits);
        }
        await refreshBalances(provider, userAddress, stableSymbol);
      }
    } catch (err) {
      console.warn('Failed to sync onchain state:', err);
    }
  };

  const handleConnectWallet = async () => {
    if (isConnected) {
      setIsConnected(false);
      setWalletAddress('');
      setRawWalletAddress('');
      setOkbBalance(0);
      setStableBalance(0);
      return;
    }

    const provider = typeof window !== 'undefined' ? (window.okxwallet || window.ethereum) : null;

    if (provider) {
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length > 0) {
          const addr = accounts[0];
          setIsConnected(true);
          setRawWalletAddress(addr);
          const formatted = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
          setWalletAddress(formatted);
          
          await syncOnchainState(provider, addr);
        }
      } catch (err: any) {
        console.error('Wallet connection failed:', err);
        showToast('Wallet connection failed or was rejected. Please try again.');
      }
    } else {
      showToast('No Web3 wallet detected. Please install OKX Wallet or MetaMask to continue.');
    }
  };

  // Shared Footer Component
  const RenderFooter = () => (
    <footer className="professional-footer" style={styles.professionalFooter}>
      <div className="footer-grid" style={styles.footerGrid}>
        <div style={styles.footerColMain}>
          <div style={styles.footerLogoRow}>
            <svg style={styles.logoSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8v10M8 14h8" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={styles.footerBrandName}>Keel</span>
          </div>
          <p style={styles.footerTagline}>
            A self-stabilizing dynamic fee protocol built natively on Uniswap v4.
          </p>
        </div>
        
        <div style={styles.footerCol}>
          <span style={styles.footerColTitle}>Protocol</span>
          <button onClick={() => navigateToApp('swap')} style={styles.footerLinkBtn}>Swap</button>
          <button onClick={() => navigateToApp('pools')} style={styles.footerLinkBtn}>Pools</button>
          <button onClick={() => navigateToApp('vault')} style={styles.footerLinkBtn}>Vault</button>
          <button onClick={() => navigateToApp('logs')} style={styles.footerLinkBtn}>Logs</button>
        </div>

        <div style={styles.footerCol}>
          <span style={styles.footerColTitle}>Resources</span>
          <a href="/docs.html" target="_blank" rel="noreferrer" style={styles.footerLink}>Documentation</a>
          <a href="https://uniswap.org" target="_blank" rel="noreferrer" style={styles.footerLink}>Uniswap v4 spec</a>
          <a href="https://github.com" target="_blank" rel="noreferrer" style={styles.footerLink}>Github</a>
        </div>

        <div style={styles.footerCol}>
          <span style={styles.footerColTitle}>Status</span>
          <span style={styles.footerStatusText}>X Layer</span>
          <span style={styles.footerStatusText}>Stabilizer active</span>
        </div>
      </div>

      <div style={styles.footerBottom}>
        <span>© 2026 Keel.</span>
      </div>
    </footer>
  );

  // Rendering branches
  if (currentPage === 'landing') {
    return (
      <div style={styles.landingRoot}>
        {/* Landing Global Announcement Banner */}
        <div className="app-announcement-banner" style={styles.appAnnouncementBanner}>
          <span>KEEL is a self-stabilizing Uniswap v4 Hook for X Layer liquidity.</span>
        </div>

        {/* Landing Global Header */}
        <header className="landing-header" style={styles.landingHeader}>
          <div className="brand-lockup" style={styles.landingLogoRow}>
            <svg style={styles.logoSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8v10M8 14h8" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={styles.landingBrandTitle}>Keel</span>
          </div>

          <nav className="landing-nav" style={styles.landingNav}>
            <button
              onClick={() => {
                const el = document.getElementById('problem');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={styles.landingNavLink}
            >
              Features
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('architecture');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              style={styles.landingNavLink}
            >
              Architecture
            </button>
            <a
              href="/docs.html"
              target="_blank"
              rel="noreferrer"
              style={styles.landingNavLinkAnchor}
            >
              Docs
            </a>
          </nav>

          <div className="landing-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

            <button 
              onClick={() => navigateToApp('swap')}
              style={styles.landingLaunchBtn}
            >
              Launch app
            </button>
          </div>
        </header>

        {/* Landing Page Content */}
        <main style={styles.landingMain}>
          {/* Hero Section */}
          <section className="dot-grid" style={styles.landingHeroSection}>
            <div className="landing-hero-container" style={styles.landingHeroContainer}>
              <div className="landing-hero-text-col" style={styles.landingHeroTextCol}>
                <h1 style={styles.heroTitle}>
                  A Uniswap pool that balances itself
                </h1>
                <p style={styles.heroSubtitle}>
                  Traditional pools bleed value when prices swing. Keel is an active Uniswap v4 hook that uses dynamic fees to protect liquidity, charging toxic trades a surcharge to reward trades that restore balance.
                </p>
                <div className="cta-row" style={styles.ctaRow}>
                  <button 
                    onClick={() => navigateToApp('swap')} 
                    style={styles.primaryBtn}
                  >
                    Launch app
                  </button>
                  <a 
                    href="/docs.html"
                    target="_blank"
                    rel="noreferrer"
                    style={styles.secondaryBtnAnchor}
                  >
                    Explore docs
                  </a>
                </div>
              </div>
            </div>
            {/* Comparison banner details */}
            <div className="comparison-container" style={styles.comparisonContainer}>
              <div className="comparison-inner" style={styles.comparisonInner}>
                <div style={styles.bannerCol}>
                  <span style={styles.bannerHeader}>Standard AMM pools</span>
                  <span style={styles.bannerText}>• Passive inventory depletion</span>
                  <span style={styles.bannerText}>• LPs absorb directional toxic damage</span>
                  <span style={styles.bannerText}>• Static fees during intensive pool drain</span>
                </div>
                <div className="banner-col-right" style={{ ...styles.bannerCol, borderLeft: '1px solid var(--border-color)', paddingLeft: '32px' }}>
                  <span style={{ ...styles.bannerHeader, color: 'var(--text-primary)' }}>Keel active pools</span>
                  <span style={styles.bannerText}>• Self-stabilizing flow engine</span>
                  <span style={styles.bannerText}>• Harmful flow builds recovery reserves</span>
                  <span style={styles.bannerText}>• Dynamic incentives reward corrective swaps</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section: The Pain */}
          <section id="problem" style={styles.landingFeatureSection}>
            <div style={styles.landingSectionContainer}>
              <div className="content-grid-reverse" style={styles.contentGridReverse}>
                <div style={styles.descText}>
                  <div style={{ ...styles.sectionHeader, alignItems: 'flex-start', textAlign: 'left', marginBottom: '24px' }}>
                    <span style={styles.sectionTag}>01 / Structural risk</span>
                    <h2 style={styles.sectionTitle}>AMMs are passive inventory sinks</h2>
                  </div>
                  <p style={styles.bodyParagraph}>
                    When one-sided market flow hits a pool, liquidity providers absorb the structural loss. Standard constant-product curves cannot identify whether a trade is stabilizing or draining reserves.
                  </p>
                  <p style={{ ...styles.bodyParagraph, marginTop: '16px', color: 'var(--text-secondary)' }}>
                    Arbitrageurs repeatedly swap in the same direction, pushing pool balance to critical bounds, causing capsizing risk and severe impermanent loss.
                  </p>
                </div>
                <div className="architecture-visual">
                  <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <svg width="100%" height="100%" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Axes */}
                      <path d="M 40 20 L 40 120 L 220 120" stroke="var(--border-color)" strokeWidth="2" fill="none" strokeDasharray="4 4" />
                      {/* AMM Curve */}
                      <path d="M 48 30 Q 60 100 200 100" stroke="var(--text-primary)" strokeWidth="3" fill="none" strokeLinecap="round" />
                      {/* Extreme state indicator */}
                      <circle cx="180" cy="100" r="6" fill="var(--text-primary)" />
                      <circle cx="180" cy="100" r="14" fill="var(--text-primary)" fillOpacity="0.1" />
                      <line x1="180" y1="100" x2="180" y2="120" stroke="var(--text-primary)" strokeWidth="2" strokeDasharray="4 4" />
                      <text x="175" y="135" fill="var(--text-primary)" fontSize="10" fontFamily="var(--font-mono)" fontWeight="bold">CRITICAL</text>
                      <text x="80" y="135" fill="var(--text-secondary)" fontSize="10" fontFamily="var(--font-mono)">BALANCED</text>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: The Stabilization Loop */}
          <section style={styles.landingFeatureSectionWhite}>
            <div style={styles.landingSectionContainer}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTag}>02 / Active stabilization</span>
                <h2 style={styles.sectionTitle}>The self-correcting incentive loop</h2>
              </div>
              <div className="rich-timeline">
                <div className="rich-timeline-card">
                  <div className="rich-timeline-number">1</div>
                  <h3 style={styles.stepTitle}>Observe pool flow</h3>
                  <p style={styles.stepBody}>The hook tracks directional transaction volume in real time.</p>
                </div>
                <div className="rich-timeline-card">
                  <div className="rich-timeline-number">2</div>
                  <h3 style={styles.stepTitle}>Apply dynamic friction</h3>
                  <p style={styles.stepBody}>Toxic swaps that worsen imbalance are charged a dynamic surcharge.</p>
                </div>
                <div className="rich-timeline-card">
                  <div className="rich-timeline-number">3</div>
                  <h3 style={styles.stepTitle}>Fund recovery vault</h3>
                  <p style={styles.stepBody}>Surcharges are automatically collected in the pool recovery budget.</p>
                </div>
                <div className="rich-timeline-card">
                  <div className="rich-timeline-number">4</div>
                  <h3 style={styles.stepTitle}>Reward corrective swaps</h3>
                  <p style={styles.stepBody}>Healing swaps receive fee discounts and recovery credits.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Hook Lifecycle */}
          <section id="architecture" style={styles.landingFeatureSection}>
            <div style={styles.landingSectionContainer}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTag}>03 / Architecture</span>
                <h2 style={styles.sectionTitle}>Uniswap v4 native integration</h2>
              </div>
              <div className="content-grid" style={styles.contentGrid}>
                <div style={styles.architectureContent}>
                  <p style={styles.bodyParagraph}>
                    Keel operates natively within the Uniswap v4 pool manager lifecycle, executing code hooks during transaction phases to calculate fees and adjust reserves.
                  </p>
                  <div className="tech-two-col-grid" style={styles.techTwoColGrid}>
                    <div style={styles.techCard}>
                      <span style={styles.techKeyword}>beforeSwap() hook</span>
                      <p style={styles.techDesc}>
                        Intercepts swaps prior to execution to compute reserve imbalance, classify flow, and calculate the dynamic fee.
                      </p>
                    </div>
                    <div style={styles.techCard}>
                      <span style={styles.techKeyword}>afterSwap() hook</span>
                      <p style={styles.techDesc}>
                        Executes post-swap. Surcharges are routed to the vault, and credits are rewarded for corrective actions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rich-code-window">
                  <div className="rich-code-header">
                    <div className="rich-code-dots">
                      <div className="rich-code-dot" style={{ backgroundColor: '#FF5F56' }} />
                      <div className="rich-code-dot" style={{ backgroundColor: '#FFBD2E' }} />
                      <div className="rich-code-dot" style={{ backgroundColor: '#27C93F' }} />
                    </div>
                    <span className="rich-code-filename">KeelHook.sol</span>
                  </div>
                  <pre style={{ margin: 0, padding: '20px', overflowX: 'auto', color: '#FAFAFC', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: '1.45', backgroundColor: '#0D0E12' }}>
{`// Intercept swap to override dynamic fee
function beforeSwap(
    address,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata params,
    bytes calldata
) external view override returns (bytes4, BeforeSwapDelta, uint24) {
    // 1. Calculate pool reserve imbalance
    // 2. Compute toxic surcharge or healing discount
    // 3. Override standard LP swap fee
    return (
        IHooks.beforeSwap.selector,
        BeforeSwapDelta.wrap(0),
        OVERRIDE_FEE_FLAG | breakdown.finalFee
    );
}`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Section: The LP Shield */}
          <section style={styles.landingFeatureSectionWhite}>
            <div style={styles.landingSectionContainer}>
              <div className="content-grid-reverse" style={styles.contentGridReverse}>
                <div style={styles.descText}>
                  <div style={{ ...styles.sectionHeader, alignItems: 'flex-start', textAlign: 'left', marginBottom: '24px' }}>
                    <span style={styles.sectionTag}>04 / LP protection</span>
                    <h2 style={styles.sectionTitle}>Defending liquidity against inventory drift</h2>
                  </div>
                  <p style={styles.bodyParagraph}>
                    Traditional automated market makers are completely passive inventory sinks. When the market moves in one direction, liquidity providers buy high and sell low, absorbing permanent value loss.
                  </p>
                  <p style={{ ...styles.bodyParagraph, marginTop: '16px', color: 'var(--text-secondary)' }}>
                    Keel acts as an automated inventory shield. By introducing dynamic transaction friction on unbalanced trades, it creates a defensive spread that cushions LPs from toxic arbitrage flow during high-drift conditions.
                  </p>
                </div>
                <div className="architecture-visual">
                  <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <svg width="100%" height="100%" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Shield background */}
                      <path d="M120 20 L40 50 V90 C40 130 120 150 120 150 C120 150 200 130 200 90 V50 L120 20 Z" fill="var(--bg-color)" stroke="var(--border-color)" strokeWidth="2" />
                      <path d="M120 35 L60 58 V90 C60 118 120 135 120 135 C120 135 180 118 180 90 V58 L120 35 Z" fill="var(--text-primary)" fillOpacity="0.05" stroke="var(--text-primary)" strokeWidth="2" />
                      {/* Center dynamic arrows */}
                      <path d="M120 65 L120 110" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
                      <path d="M105 80 L120 65 L135 80" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M105 95 L120 110 L135 95" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <RenderFooter />
      </div>
    );
  }

  // Render App Dashboard Layout
  return (
    <div style={styles.appRootWrapper}>
      {/* App announcement mini banner */}
      <div className="app-announcement-banner" style={styles.appAnnouncementBanner}>
        <span>X Layer // Active Keel stabilizer pool</span>
      </div>

      {/* App Navigation Header */}
      <header className="app-header" style={styles.appHeader}>
        <div className="app-header-container" style={styles.appHeaderContainer}>
          <div className="brand-lockup" onClick={navigateToLanding} style={{ ...styles.landingLogoRow, cursor: 'pointer' }}>
            <svg style={styles.logoSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22h20L12 2z" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8v10M8 14h8" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={styles.brandTitle}>Keel</span>
          </div>

          {/* Tab Navigation & Separate Docs link */}
          <div className="app-nav-wrapper">
            <nav className="app-nav-tabs">
              <button
                onClick={() => navigateToApp('swap')}
                className={`app-tab-btn ${appSubPage === 'swap' ? 'active' : ''}`}
              >
                Swap
              </button>
              <button
                onClick={() => navigateToApp('pools')}
                className={`app-tab-btn ${appSubPage === 'pools' ? 'active' : ''}`}
              >
                Pools
              </button>
              <button
                onClick={() => navigateToApp('vault')}
                className={`app-tab-btn ${appSubPage === 'vault' ? 'active' : ''}`}
              >
                Vault
              </button>
              <button
                onClick={() => navigateToApp('logs')}
                className={`app-tab-btn ${appSubPage === 'logs' ? 'active' : ''}`}
              >
                Logs
              </button>
            </nav>
            <a
              href="/docs.html"
              target="_blank"
              rel="noreferrer"
              className="app-docs-link-separate"
            >
              <span>Docs</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>

          <div className="header-right-row" style={styles.headerRightRow}>
            {/* Search affordance reserved for expanded pool coverage */}
            <div className="search-bar-wrapper" style={styles.searchBarWrapper}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
                <circle cx="11" cy="11" r="8" stroke="#8F94A2" strokeWidth="2.5" />
                <path d="M21 21l-4.35-4.35" stroke="#8F94A2" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <input type="text" placeholder="Search pools or tokens" style={styles.searchInput} disabled />
            </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
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

            <button 
              onClick={handleWalletClick}
              style={isConnected ? styles.connectedWalletBtn : styles.connectWalletBtn}
            >
              {isConnected && <span style={styles.connectedDot} />}
              <span>{isConnected ? walletAddress : 'Connect wallet'}</span>
            </button>

            {showWalletDropdown && isConnected && (
              <div style={styles.walletDropdown}>
                <button 
                  onClick={async () => {
                    const fullAddress = rawWalletAddress || '0xa14e414c124e93a02cfc80b91d293d0c9f801648';
                    try {
                      await navigator.clipboard.writeText(fullAddress);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      console.warn('Failed to copy address:', err);
                    }
                  }}
                  style={styles.walletDropdownItem}
                  className="wallet-dropdown-item"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>{copied ? 'Copied!' : 'Copy address'}</span>
                </button>
                
                <div style={styles.walletDropdownDivider} />
                
                <button 
                  onClick={() => {
                    handleConnectWallet();
                    setShowWalletDropdown(false);
                  }}
                  style={{ ...styles.walletDropdownItem, color: '#E11D48' }}
                  className="wallet-dropdown-item"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {/* App Body Content */}
      <main style={styles.appMainContent}>
        {appSubPage === 'swap' && (
          <div style={styles.poolsSection}>
            <div style={styles.appTitleBlock}>
              <h1 style={styles.appMainTitle}>Protected Swap</h1>
              <p style={styles.appSubtitleText}>
                Execute swaps protected by the KEEL Hook. Toxic flow is penalized with dynamic drag, while healing flow earns discounts.
              </p>
            </div>
            
            <div className="app-layout-container" style={styles.appLayoutContainer}>
              <div style={styles.appColumn}>
                <SwapPanel
                  preview={preview}
                  zeroForOne={zeroForOne}
                  setZeroForOne={setZeroForOne}
                  amount={amount}
                  setAmount={setAmount}
                  onSwap={handleSwap}
                  isConnected={isConnected}
                  onConnectWallet={handleConnectWallet}
                  stableSymbol={stableSymbol}
                  onStableSymbolChange={setStableSymbol}
                  okbBalance={okbBalance}
                  stableBalance={stableBalance}
                  okbPrice={okbPrice}
                />
              </div>
              <div style={styles.appColumn}>
                <SwapContextSidebar
                  token0Vol={token0Vol}
                  token1Vol={token1Vol}
                  imbalanceBps={imbalanceBps}
                  recoveryBudget={recoveryBudget}
                  stableSymbol={stableSymbol}
                />
              </div>
            </div>
          </div>
        )}

        {appSubPage === 'pools' && (
          <div style={styles.poolsSection}>
            <div style={styles.appTitleBlock}>
              <h1 style={styles.appMainTitle}>Pool Stabilizer Metrics</h1>
              <p style={styles.appSubtitleText}>
                Monitor directional flow, imbalance, and active KEEL defense mode across protected pools.
              </p>
              {poolReadError && (
                <p style={{ ...styles.appSubtitleText, color: '#B42318', marginTop: '8px' }}>
                  {poolReadError}
                </p>
              )}
            </div>
            
            <div className="app-layout-container" style={styles.appLayoutContainer}>
              <div style={styles.appColumn}>
                <KeelAxis
                  token0Vol={token0Vol}
                  token1Vol={token1Vol}
                  imbalanceBps={imbalanceBps}
                  stableSymbol={stableSymbol}
                />
              </div>
              <div style={styles.appColumn}>
                <PoolHealthCard
                  token0Vol={token0Vol}
                  token1Vol={token1Vol}
                  imbalanceBps={imbalanceBps}
                  baseFee={baseFee}
                  minFee={minFee}
                  maxFee={maxFee}
                  neutralThreshold={neutralThreshold}
                  stableSymbol={stableSymbol}
                />
              </div>
            </div>
          </div>
        )}

        {appSubPage === 'vault' && (
          <div style={styles.poolsSection}>
            <div style={styles.appTitleBlock}>
              <h1 style={styles.appMainTitle}>Recovery Vault</h1>
              <p style={styles.appSubtitleText}>
                Track recovery reserves funded by toxic flow and credits earned by healing swaps.
              </p>
            </div>
            <div style={{ width: '100%', maxWidth: '520px', margin: '0 auto' }}>
              <RecoveryVaultCard
                recoveryBudget={recoveryBudget}
                userCredits={userCredits}
                stableSymbol={stableSymbol}
              />
            </div>
          </div>
        )}

        {appSubPage === 'logs' && (
          <div style={styles.poolsSection}>
            <div style={styles.appTitleBlock}>
              <h1 style={styles.appMainTitle}>Onchain events</h1>
              <p style={styles.appSubtitleText}>
                Inspect live KEEL Hook events emitted from swap classification, stabilization, flow updates, and recovery credits.
              </p>
            </div>
            <OnchainProof
              events={events}
              hookAddress={hookAddress}
              vaultAddress={vaultAddress}
              managerAddress={managerAddress}
              poolId={poolId}
              eventSource={eventSource}
              explorerBaseUrl={explorerBaseUrl}
            />
          </div>
        )}
      </main>

      <RenderFooter />
      {/* Global Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FF5F56',
          color: '#FAFAFC',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          zIndex: 9999,
          animation: 'toast-in 0.3s ease-out',
          textAlign: 'center',
          maxWidth: '90vw'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

const styles = {
  // Landing Page Styles (Clean, full width, responsive, elegant spacing)
  landingRoot: {
    minHeight: '100vh',
    backgroundColor: 'var(--container-bg)',
    fontFamily: 'var(--font-display)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  landingHeader: {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--container-bg)',
    borderBottom: '1px solid var(--border-color)',
  },
  landingLogoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoSvg: {
    width: '28px',
    height: '28px',
  },
  landingBrandTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  landingNav: {
    display: 'flex',
    gap: '32px',
  },
  landingNavLink: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'color 0.2s',
    ':hover': {
      color: 'var(--text-primary)',
    },
  },
  landingNavLinkAnchor: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'color 0.2s',
    cursor: 'pointer',
    ':hover': {
      color: 'var(--text-primary)',
    },
  },
  landingLaunchBtn: {
    backgroundColor: 'var(--text-primary)',
    color: 'var(--container-bg)',
    border: 'none',
    padding: '10px 22px',
    borderRadius: '100px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  landingMain: {
    flex: 1,
  },
  landingHeroSection: {
    backgroundColor: 'var(--bg-color)',
    padding: '80px 20px 60px 20px',
    borderBottom: '1px solid var(--border-color)',
  },
  landingHeroContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '64px',
    alignItems: 'center',
  },
  landingHeroTextCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'var(--container-bg-hover)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    padding: '6px 14px',
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '600',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.5px',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.1',
    letterSpacing: '-1.5px',
  },
  heroSubtitle: {
    fontSize: '18px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  ctaRow: {
    display: 'flex',
    gap: '16px',
  },
  primaryBtn: {
    padding: '14px 28px',
    backgroundColor: 'var(--text-primary)',
    border: 'none',
    color: 'var(--container-bg)',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: 'var(--shadow-button)',
  },
  secondaryBtn: {
    padding: '14px 28px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  secondaryBtnAnchor: {
    padding: '14px 28px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '14px',
    borderRadius: '12px',
    cursor: 'pointer',
    textDecoration: 'none',
    textAlign: 'center' as const,
    display: 'inline-block',
    transition: 'all 0.15s ease',
  },
  heroImageCol: {
    display: 'flex',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    maxWidth: '320px',
    height: 'auto',
    borderRadius: '24px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.04)',
  },
  comparisonContainer: {
    maxWidth: '1200px',
    margin: '60px auto 0 auto',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '40px',
  },
  comparisonInner: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '40px',
  },
  bannerCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  bannerHeader: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
  },
  bannerText: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.4',
  },
  landingFeatureSection: {
    backgroundColor: 'var(--bg-color)',
    padding: '80px 20px',
    borderBottom: '1px solid var(--border-color)',
  },
  landingFeatureSectionWhite: {
    backgroundColor: 'var(--container-bg)',
    padding: '80px 20px',
    borderBottom: '1px solid var(--border-color)',
  },
  landingSectionContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '40px',
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  sectionTag: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: '#8F94A2',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  sectionTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-1px',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '64px',
    alignItems: 'center',
  },
  contentGridReverse: {
    display: 'grid',
    gridTemplateColumns: '0.8fr 1.2fr',
    gap: '64px',
    alignItems: 'center',
  },
  descText: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: 'var(--text-secondary)',
  },
  bodyParagraph: {
    color: 'var(--text-secondary)',
  },
  visualConsole: {
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12.5px',
    boxShadow: 'var(--shadow-premium)',
  },
  flowRow: {
    padding: '12px 16px',
    backgroundColor: 'var(--bg-color)',
    borderRadius: '10px',
    border: '1px solid var(--border-color)',
    borderLeft: '3px solid var(--text-primary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flowAlert: {
    padding: '12px',
    borderRadius: '10px',
    border: '1px dashed var(--border-color)',
    color: 'var(--text-secondary)',
    textAlign: 'center' as const,
    fontSize: '11px',
    marginTop: '6px',
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '28px',
  },
  stepItem: {
    display: 'flex',
    gap: '20px',
  },
  stepNum: {
    width: '32px',
    height: '32px',
    borderRadius: '100px',
    border: '1.5px solid var(--text-primary)',
    backgroundColor: 'var(--container-bg)',
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
    fontSize: '14.5px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  stepBody: {
    fontSize: '13.5px',
    color: '#5F6370',
    lineHeight: '1.45',
  },
  quoteCard: {
    border: '1px solid var(--border-color)',
    borderRadius: '24px',
    padding: '40px',
    backgroundColor: 'var(--bg-color)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  quoteLine: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
  },
  quoteBody: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },
  architectureContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
  },
  techTwoColGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '32px',
  },
  techCard: {
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.01)',
  },
  techKeyword: {
    fontSize: '14px',
    fontFamily: 'var(--font-mono)',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  techDesc: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },

  // App Dashboard Page Layout (Focused environment, separate stylesheet)
  appRootWrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-color)',
  },
  appAnnouncementBanner: {
    width: '100%',
    backgroundColor: 'var(--text-primary)',
    color: 'var(--container-bg)',
    padding: '8px 20px',
    textAlign: 'center' as const,
    fontSize: '11px',
    fontWeight: '500',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    borderBottom: '1px solid var(--border-color)',
  },
  appHeader: {
    backgroundColor: 'var(--container-bg)',
    borderBottom: '1px solid var(--border-color)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  },
  appHeaderContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  appNavTabs: {
    display: 'flex',
    gap: '8px',
    backgroundColor: 'var(--bg-color)',
    padding: '4px',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    alignItems: 'center',
  },
  appTabBtn: {
    background: 'none',
    border: 'none',
    padding: '8px 16px',
    fontSize: '13.5px',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
  },
  appNavAnchor: {
    display: 'inline-block',
    padding: '8px 16px',
    fontSize: '13.5px',
    color: 'var(--text-muted)',
    textDecoration: 'none',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
    ':hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'var(--container-bg-hover)',
    },
  },
  headerRightRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  searchBarWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '8px 12px',
    width: '200px',
    gap: '8px',
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '12.5px',
    color: 'var(--text-primary)',
    width: '100%',
  },
  connectWalletBtn: {
    backgroundColor: 'var(--text-primary)',
    color: 'var(--container-bg)',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '100px',
    fontWeight: '600',
    fontSize: '12.5px',
    cursor: 'pointer',
  },
  connectedWalletBtn: {
    backgroundColor: 'var(--container-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    padding: '8px 16px',
    borderRadius: '100px',
    fontWeight: '600',
    fontSize: '12.5px',
    fontFamily: 'var(--font-mono)',
  },
  connectedDot: {
    width: '6px',
    height: '6px',
    borderRadius: '100px',
    backgroundColor: '#10B981',
    display: 'inline-block',
    marginRight: '6px',
  },
  appMainContent: {
    maxWidth: '1200px',
    width: '100%',
    margin: '0 auto',
    padding: '40px 20px',
    flex: 1,
  },
  centeredAppSwapSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '32px',
    paddingTop: '40px',
    minHeight: '480px',
    justifyContent: 'center',
  },
  poolsSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
  },
  appTitleBlock: {
    textAlign: 'left' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '6px',
    width: '100%',
    marginBottom: '8px',
  },
  appMainTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  appSubtitleText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.45',
  },
  appLayoutContainer: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: '32px',
    alignItems: 'start',
  },
  appColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  scenarioCardInner: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  scenarioHeader: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '12px',
  },
  scenarioTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  scenarioSubtitle: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
  },
  scenarioButtons: {
    display: 'flex',
    gap: '12px',
  },
  scenarioBtnApp: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    ':hover': {
      borderColor: 'var(--border-active)',
      backgroundColor: 'var(--bg-color)',
    },
  },

  // Professional Footer Styles
  professionalFooter: {
    borderTop: '1px solid var(--border-color)',
    padding: '60px 20px 30px 20px',
    backgroundColor: 'var(--container-bg)',
    width: '100%',
  },
  footerGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    gap: '48px',
    paddingBottom: '40px',
    borderBottom: '1px solid var(--border-color)',
  },
  footerColMain: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  footerLogoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  footerBrandName: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  footerTagline: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    maxWidth: '280px',
  },
  footerCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  footerColTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#8F94A2',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  footerLinkBtn: {
    background: 'none',
    border: 'none',
    textAlign: 'left' as const,
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-display)',
    transition: 'color 0.15s ease',
    ':hover': {
      color: 'var(--text-primary)',
    },
  },
  footerLink: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'color 0.15s ease',
    ':hover': {
      color: 'var(--text-primary)',
    },
  },
  footerStatusText: {
    fontSize: '13.5px',
    color: 'var(--text-secondary)',
    fontWeight: '500',
  },
  footerBottom: {
    maxWidth: '1200px',
    margin: '24px auto 0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#8F94A2',
  },
  // Added grid styles for parameter lists on landing features
  paramGrid: {
    display: 'flex',
    gap: '16px',
    width: '100%',
    marginTop: '8px',
  },
  paramItemLanding: {
    flex: 1,
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    fontFamily: 'var(--font-mono)',
  },
  paramLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  paramVal: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  landingSimulatorCard: {
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '24px',
    padding: '24px',
    boxShadow: 'var(--shadow-card)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    transition: 'all 0.3s ease',
  },
  simHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  simTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  simBadge: {
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    border: '1px solid',
    borderRadius: '100px',
    textTransform: 'uppercase' as const,
    fontFamily: 'var(--font-mono)',
  },
  simAxisContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  simAxisLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: '#8F94A2',
  },
  simAxisTrack: {
    position: 'relative' as const,
    height: '8px',
    backgroundColor: 'var(--bg-color)',
    borderRadius: '100px',
    border: '1px solid var(--border-color)',
    overflow: 'visible',
    margin: '6px 0',
  },
  simAxisCenterLine: {
    position: 'absolute' as const,
    left: '50%',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: 'var(--border-color)',
  },
  simAxisPointer: {
    position: 'absolute' as const,
    top: '-3px',
    width: '14px',
    height: '14px',
    borderRadius: '100px',
    backgroundColor: 'var(--text-primary)',
    border: '2px solid var(--container-bg)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transform: 'translateX(-50%)',
    transition: 'left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
  },
  simMetricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  simMetricBox: {
    backgroundColor: 'var(--bg-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    fontFamily: 'var(--font-mono)',
  },
  simMetricLabel: {
    fontSize: '9px',
    color: '#8F94A2',
    fontWeight: '500',
  },
  simMetricValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  simLogsConsole: {
    backgroundColor: '#0D0E12',
    borderRadius: '12px',
    padding: '12px 16px',
    fontFamily: 'var(--font-mono)',
    fontSize: '10.5px',
    color: '#FAFAFC',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    minHeight: '96px',
    textAlign: 'left' as const,
  },
  simLogLine: {
    display: 'flex',
    gap: '8px',
    lineHeight: '1.4',
  },
  simLogArrow: {
    color: '#8F94A2',
  },
  simActionsRow: {
    display: 'flex',
    gap: '8px',
  },
  simBtn: {
    flex: 1,
    padding: '10px',
    fontSize: '11px',
    fontWeight: '600',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'all 0.15s ease',
  },
  walletDropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    right: 0,
    backgroundColor: 'var(--container-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '8px',
    boxShadow: 'var(--shadow-card)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    minWidth: '170px',
  },
  walletDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'background-color 0.15s ease',
  },
  walletDropdownDivider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '4px 8px',
  },
};
