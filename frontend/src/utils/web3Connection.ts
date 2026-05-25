/**
 * Lightweight JSON-RPC helper to read Keel v4 Hook contracts without ethers/viem
 */
import { ethers } from 'ethers';

// Function selectors (first 4 bytes of keccak256 hash of signature)
const SELECTORS = {
  getPoolSummary: '0x96438761', // getPoolSummary(address,bytes32) -> (uint256,uint256,uint256,bool,bool,uint8,uint256)
  getTraderData: '0xc6bc7659',  // getTraderData(address,bytes32,address) -> (uint256)
  previewSwap: '0xd36a7778'     // previewSwap(address,bytes32,bool) -> (uint8,uint24,uint24,uint24,uint24)
};

const EXECUTOR_ABI = [
  "function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external payable returns (int256 delta)"
];

const EVENT_SIGNATURES = {
  FlowUpdated: '0x555f3c3fc6e42501a82ea5f165d59d34a16a205176c97f81a1cf2a944c360203',
  SwapClassified: '0xfb083103d4c0848f00648d27d15500e451afe3e204005defd0f8ae0024ee7f26',
  StabilizationApplied: '0x54bd457dc4b09474e39c236d6e29852cd7c1c05ee32d22e9c0ad53e9171faf21',
  RecoveryCredited: '0x6a988fe019f336e4fefd6a84a892fdf2c5ce60865316b824be03d350901df720'
};

const MAINNET_PROOF_TXS = [
  '0xb4fa9fd93d92a7ccd44825ed3ebe500974eef96785e57a8c976c8091e9fbf3d3',
  '0xb2670d9ddea8d3f7aa9558b5a2571863f0ce0c33a56f1c246a35e0aed774d974',
  '0xa139e06b9954087613620165fe78b453be4d57229710ae8a7e4bb74df8d4d00c',
];


// Pads an address to 32 bytes
function padAddress(addr: string): string {
  const clean = addr.replace(/^0x/, '');
  return clean.toLowerCase().padStart(64, '0');
}

// Decodes a 32-byte hex chunk to bigint
function hexToBigInt(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
}

// Decodes boolean value
function hexToBool(hex: string): boolean {
  return hexToBigInt(hex) !== 0n;
}

export interface Web3PoolSummary {
  token0Volume: number;
  token1Volume: number;
  imbalanceBps: number;
  hasDominant: boolean;
  dominantZeroForOne: boolean;
  healthStatus: number;
  recoveryBudget: number;
}

export interface TxReceiptLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

export interface TxReceipt {
  blockNumber: string;
  status?: string;
  transactionHash: string;
  logs: TxReceiptLog[];
}

/**
 * Reads Keel pool status directly from the lens contract onchain using eth_call
 */
export async function readPoolSummaryOnchain(
  provider: any,
  lensAddress: string,
  hookAddress: string,
  poolId: string
): Promise<Web3PoolSummary | null> {
  try {
    // Encode args: hookAddress (20 bytes padded to 32) + poolId (32 bytes)
    const calldata = 
      SELECTORS.getPoolSummary + 
      padAddress(hookAddress) + 
      poolId.replace(/^0x/, '');

    const response = await provider.request({
      method: 'eth_call',
      params: [{ to: lensAddress, data: calldata }, 'latest']
    });

    if (!response || response === '0x') return null;

    // Decode summary structure (7 fields of 32 bytes each)
    const cleanHex = response.replace(/^0x/, '');
    const v0Hex = cleanHex.slice(0, 64);
    const v1Hex = cleanHex.slice(64, 128);
    const imbalanceHex = cleanHex.slice(128, 192);
    const dominantHex = cleanHex.slice(192, 256);
    const zfoHex = cleanHex.slice(256, 320);
    const healthHex = cleanHex.slice(320, 384);
    const budgetHex = cleanHex.slice(384, 448);

    return {
      token0Volume: Number(hexToBigInt(v0Hex)) / 1e18,
      token1Volume: Number(hexToBigInt(v1Hex)) / 1e6,
      imbalanceBps: Number(hexToBigInt(imbalanceHex)),
      hasDominant: hexToBool(dominantHex),
      dominantZeroForOne: hexToBool(zfoHex),
      healthStatus: Number(hexToBigInt(healthHex)),
      recoveryBudget: Number(hexToBigInt(budgetHex)) / 1e18
    };
  } catch (err) {
    console.warn('Failed to query onchain pool summary:', err);
    return null;
  }
}

/**
 * Reads a trader's earned credits from the recovery vault onchain using eth_call
 */
export async function readTraderCreditsOnchain(
  provider: any,
  lensAddress: string,
  hookAddress: string,
  poolId: string,
  traderAddress: string
): Promise<number | null> {
  try {
    // Encode args: hookAddress + poolId + traderAddress
    const calldata = 
      SELECTORS.getTraderData + 
      padAddress(hookAddress) + 
      poolId.replace(/^0x/, '') + 
      padAddress(traderAddress);

    const response = await provider.request({
      method: 'eth_call',
      params: [{ to: lensAddress, data: calldata }, 'latest']
    });

    if (!response || response === '0x') return null;

    const value = hexToBigInt(response);
    return Number(value) / 1e18;
  } catch (err) {
    console.warn('Failed to query trader credits:', err);
    return null;
  }
}

/**
 * Reads native OKB balance of an address
 */
export async function readNativeBalance(provider: any, address: string): Promise<number> {
  try {
    const response = await provider.request({
      method: 'eth_getBalance',
      params: [address, 'latest']
    });
    if (!response || response === '0x') return 0;
    return Number(BigInt(response)) / 1e18;
  } catch (err) {
    console.warn('Failed to query native balance:', err);
    return 0;
  }
}

/**
 * Reads ERC20 token balance of an address
 */
export async function readERC20Balance(
  provider: any,
  tokenAddress: string,
  address: string,
  decimals: number = 6
): Promise<number> {
  try {
    const calldata = '0x70a08231' + padAddress(address);
    const response = await provider.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: calldata }, 'latest']
    });
    if (!response || response === '0x') return 0;
    return Number(BigInt(response)) / Math.pow(10, decimals);
  } catch (err) {
    console.warn('Failed to query ERC20 balance:', err);
    return 0;
  }
}

/**
 * Calls the deployed KEEL swap executor and waits for the confirmed receipt.
 */
export async function executeSwapOnchain(
  provider: any,
  from: string,
  executorAddress: string,
  poolKey: { currency0: string, currency1: string, fee: number, tickSpacing: number, hooks: string },
  swapParams: { zeroForOne: boolean, amountSpecified: string, sqrtPriceLimitX96: string },
  hookData: string = "0x",
  value: string = "0x0"
): Promise<TxReceipt> {
  try {
    const iface = new ethers.Interface(EXECUTOR_ABI);
    const calldata = iface.encodeFunctionData("swap", [
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
      [swapParams.zeroForOne, swapParams.amountSpecified, swapParams.sqrtPriceLimitX96],
      hookData
    ]);

    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from,
        to: executorAddress,
        data: calldata,
        value
      }]
    });
    return await waitForTransactionReceipt(provider, txHash);
  } catch (err) {
    console.warn('Transaction cancelled or failed:', err);
    throw err;
  }
}

export async function waitForTransactionReceipt(provider: any, txHash: string): Promise<TxReceipt> {
  for (let i = 0; i < 60; i++) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash]
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

export async function fetchKeelLogsOnchain(provider: any, hookAddress: string, poolId: string): Promise<any[]> {
  const parseWithTimestamps = async (logs: any[]) => {
    const blockTimestamps = new Map<string, string>();
    const parsed = [];
    for (const log of logs) {
      let timestamp = '';
      if (log.blockNumber) {
        if (!blockTimestamps.has(log.blockNumber)) {
          const block = await provider.request({ method: 'eth_getBlockByNumber', params: [log.blockNumber, false] });
          const time = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toLocaleTimeString() : '';
          blockTimestamps.set(log.blockNumber, time);
        }
        timestamp = blockTimestamps.get(log.blockNumber) || '';
      }

      const parsedLog = parseHookLog(log, timestamp);
      if (parsedLog) parsed.push(parsedLog);
    }
    return parsed;
  };

  const fetchProofReceiptLogs = async () => {
    const receiptLogs = [];
    for (const txHash of MAINNET_PROOF_TXS) {
      const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
      if (!receipt?.logs || receipt.status !== '0x1') continue;
      receiptLogs.push(
        ...receipt.logs.filter((log: any) => log.address?.toLowerCase() === hookAddress.toLowerCase())
      );
    }
    return parseWithTimestamps(receiptLogs);
  };

  try {
    const currentBlockHex = await provider.request({ method: 'eth_blockNumber' });
    const currentBlock = Number(currentBlockHex);
    const fromBlock = '0x' + Math.max(0, currentBlock - 99).toString(16);

    const logs = await provider.request({
      method: 'eth_getLogs',
      params: [{
        address: hookAddress,
        fromBlock,
        toBlock: 'latest',
        topics: [
          null, // match any event signature
          poolId // match events for this specific pool
        ]
      }]
    });

    if (!logs || !Array.isArray(logs)) return [];
    if (logs.length === 0) return fetchProofReceiptLogs();

    return parseWithTimestamps(logs);
  } catch (err) {
    console.warn('Failed to fetch onchain logs:', err);
    try {
      return await fetchProofReceiptLogs();
    } catch (receiptErr) {
      console.warn('Failed to fetch proof receipt logs:', receiptErr);
      return [];
    }
  }
}

function getTradeClass(clsId: number): string {
  return clsId === 0 ? 'Neutral' : clsId === 1 ? 'Healing' : 'Toxic';
}

export function parseHookLog(log: any, timestamp = '') {
  const sig = log.topics[0];
  const txHash = log.transactionHash;
  const dataHex = log.data.replace(/^0x/, '');
  const chunks = [];
  for (let i = 0; i < dataHex.length; i += 64) {
    chunks.push(dataHex.slice(i, i + 64));
  }

  if (sig === EVENT_SIGNATURES.FlowUpdated && chunks.length >= 4) {
    return {
      id: `${txHash}-${log.logIndex}`,
      name: 'FlowUpdated',
      timestamp,
      txHash,
      data: {
        poolId: log.topics[1],
        token0VolumeRaw: hexToBigInt(chunks[0]).toString(),
        token1VolumeRaw: hexToBigInt(chunks[1]).toString(),
        imbalanceBps: Number(hexToBigInt(chunks[2])),
        dominantDirection: Number(hexToBigInt(chunks[3]))
      }
    };
  }

  if (sig === EVENT_SIGNATURES.SwapClassified && chunks.length >= 3) {
    return {
      id: `${txHash}-${log.logIndex}`,
      name: 'SwapClassified',
      timestamp,
      txHash,
      data: {
        poolId: log.topics[1],
        trader: '0x' + log.topics[2].slice(26),
        tradeClass: getTradeClass(Number(hexToBigInt(chunks[0]))),
        swapDirection: Number(hexToBigInt(chunks[1])) === 0 ? 'OKB -> Stable' : 'Stable -> OKB',
        imbalanceBps: Number(hexToBigInt(chunks[2]))
      }
    };
  }

  if (sig === EVENT_SIGNATURES.StabilizationApplied && chunks.length >= 6) {
    return {
      id: `${txHash}-${log.logIndex}`,
      name: 'StabilizationApplied',
      timestamp,
      txHash,
      data: {
        poolId: log.topics[1],
        trader: '0x' + log.topics[2].slice(26),
        tradeClass: getTradeClass(Number(hexToBigInt(chunks[0]))),
        baseFee: Number(hexToBigInt(chunks[1])),
        toxicSurcharge: Number(hexToBigInt(chunks[2])),
        healingDiscount: Number(hexToBigInt(chunks[3])),
        finalFee: Number(hexToBigInt(chunks[4])),
        recoveryCreditEarnedRaw: hexToBigInt(chunks[5]).toString()
      }
    };
  }

  if (sig === EVENT_SIGNATURES.RecoveryCredited && chunks.length >= 2) {
    return {
      id: `${txHash}-${log.logIndex}`,
      name: 'RecoveryCredited',
      timestamp,
      txHash,
      data: {
        poolId: log.topics[1],
        trader: '0x' + log.topics[2].slice(26),
        amountRaw: hexToBigInt(chunks[0]).toString(),
        newRecoveryCreditBalanceRaw: hexToBigInt(chunks[1]).toString()
      }
    };
  }

  return null;
}
