export type TradeClass = 'Neutral' | 'Healing' | 'Toxic';

export interface FlowState {
  token0ToToken1Volume: number;
  token1ToToken0Volume: number;
}

export interface FeeBreakdown {
  baseFee: number;
  toxicSurcharge: number;
  healingDiscount: number;
  finalFee: number;
  imbalanceBps: number;
  tradeClass: TradeClass;
}

export function calculateImbalance(token0Vol: number, token1Vol: number): number {
  const total = token0Vol + token1Vol;
  if (total === 0) {
    return 0;
  }
  return Math.floor((Math.abs(token0Vol - token1Vol) * 10000) / total);
}

export function getDominantDirection(token0Vol: number, token1Vol: number): { zeroForOne: boolean; hasDominant: boolean } {
  if (token0Vol === token1Vol) {
    return { zeroForOne: false, hasDominant: false };
  }
  return { zeroForOne: token0Vol > token1Vol, hasDominant: true };
}

export function classifySwap(
  token0Vol: number,
  token1Vol: number,
  zeroForOne: boolean,
  neutralThresholdBps: number
): { tradeClass: TradeClass; imbalanceBps: number } {
  const imbalanceBps = calculateImbalance(token0Vol, token1Vol);
  
  if (imbalanceBps < neutralThresholdBps) {
    return { tradeClass: 'Neutral', imbalanceBps };
  }
  
  const { zeroForOne: dominantZeroForOne, hasDominant } = getDominantDirection(token0Vol, token1Vol);
  if (!hasDominant) {
    return { tradeClass: 'Neutral', imbalanceBps };
  }
  
  if (zeroForOne === dominantZeroForOne) {
    return { tradeClass: 'Toxic', imbalanceBps };
  } else {
    return { tradeClass: 'Healing', imbalanceBps };
  }
}

export function calculateFee(
  tradeClass: TradeClass,
  imbalanceBps: number,
  baseFee: number,
  minFee: number,
  maxFee: number
): FeeBreakdown {
  let toxicSurcharge = 0;
  let healingDiscount = 0;
  let finalFee = baseFee;

  if (tradeClass === 'Neutral') {
    finalFee = baseFee;
  } else if (tradeClass === 'Toxic') {
    if (imbalanceBps < 1500) {
      toxicSurcharge = 0;
    } else if (imbalanceBps < 3000) {
      toxicSurcharge = 1500;
    } else if (imbalanceBps < 5000) {
      toxicSurcharge = 3500;
    } else if (imbalanceBps < 7000) {
      toxicSurcharge = 6000;
    } else {
      toxicSurcharge = 10000;
    }
    finalFee = Math.min(baseFee + toxicSurcharge, maxFee);
  } else { // Healing
    if (imbalanceBps < 1500) {
      healingDiscount = 0;
    } else if (imbalanceBps < 3000) {
      healingDiscount = 500;
    } else if (imbalanceBps < 5000) {
      healingDiscount = 1000;
    } else if (imbalanceBps < 7000) {
      healingDiscount = 1500;
    } else {
      healingDiscount = 2500;
    }
    finalFee = Math.max(baseFee - healingDiscount, minFee);
  }

  return {
    baseFee,
    toxicSurcharge,
    healingDiscount,
    finalFee,
    imbalanceBps,
    tradeClass
  };
}

export function getHealthLabel(imbalanceBps: number): string {
  if (imbalanceBps < 1500) {
    return 'Centered';
  } else if (imbalanceBps < 3000) {
    return 'Leaning';
  } else if (imbalanceBps < 5000) {
    return 'Strained';
  } else if (imbalanceBps < 7000) {
    return 'Critical';
  } else {
    return 'Capsizing Risk';
  }
}
