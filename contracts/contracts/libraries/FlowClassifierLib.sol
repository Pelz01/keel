// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library FlowClassifierLib {
    enum TradeClass {
        Neutral,
        Healing,
        Toxic
    }

    struct FlowState {
        uint256 token0ToToken1Volume;
        uint256 token1ToToken0Volume;
        uint40 lastReset;
    }

    function calculateImbalance(FlowState memory self) internal pure returns (uint256 imbalanceBps) {
        uint256 totalFlow = self.token0ToToken1Volume + self.token1ToToken0Volume;
        if (totalFlow == 0) {
            return 0;
        }
        
        uint256 diff;
        if (self.token0ToToken1Volume >= self.token1ToToken0Volume) {
            diff = self.token0ToToken1Volume - self.token1ToToken0Volume;
        } else {
            diff = self.token1ToToken0Volume - self.token0ToToken1Volume;
        }
        
        imbalanceBps = (diff * 10000) / totalFlow;
    }

    function getDominantDirection(FlowState memory self) internal pure returns (bool zeroForOne, bool hasDominant) {
        if (self.token0ToToken1Volume == self.token1ToToken0Volume) {
            return (false, false);
        }
        return (self.token0ToToken1Volume > self.token1ToToken0Volume, true);
    }

    function classifySwap(
        FlowState memory self,
        bool zeroForOne,
        uint256 neutralThresholdBps
    ) internal pure returns (TradeClass tradeClass, uint256 imbalanceBps) {
        imbalanceBps = calculateImbalance(self);
        
        if (imbalanceBps < neutralThresholdBps) {
            return (TradeClass.Neutral, imbalanceBps);
        }
        
        (bool dominantZeroForOne, bool hasDominant) = getDominantDirection(self);
        if (!hasDominant) {
            return (TradeClass.Neutral, imbalanceBps);
        }
        
        if (zeroForOne == dominantZeroForOne) {
            return (TradeClass.Toxic, imbalanceBps);
        } else {
            return (TradeClass.Healing, imbalanceBps);
        }
    }
}
