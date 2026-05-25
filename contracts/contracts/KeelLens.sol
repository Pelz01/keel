// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./KeelHook.sol";
import "./RecoveryVault.sol";
import "./libraries/FlowClassifierLib.sol";
import "./libraries/KeelFeeLib.sol";

contract KeelLens {
    struct PoolSummary {
        uint256 token0ToToken1Volume;
        uint256 token1ToToken0Volume;
        uint256 imbalanceBps;
        bool hasDominant;
        bool dominantZeroForOne;
        uint8 healthStatus; // 0=Centered, 1=Leaning, 2=Strained, 3=Critical, 4=Capsizing Risk
        uint256 recoveryBudget;
    }

    struct SwapPreview {
        uint8 tradeClass;
        uint24 baseFee;
        uint24 toxicSurcharge;
        uint24 healingDiscount;
        uint24 finalFee;
    }

    function getPoolSummary(address hookAddress, bytes32 poolId) external view returns (PoolSummary memory summary) {
        KeelHook hook = KeelHook(hookAddress);
        (uint256 v0, uint256 v1, ) = hook.poolFlowStates(poolId);
        
        summary.token0ToToken1Volume = v0;
        summary.token1ToToken0Volume = v1;
        
        FlowClassifierLib.FlowState memory state = FlowClassifierLib.FlowState({
            token0ToToken1Volume: v0,
            token1ToToken0Volume: v1,
            lastReset: 0
        });
        
        summary.imbalanceBps = FlowClassifierLib.calculateImbalance(state);
        (summary.dominantZeroForOne, summary.hasDominant) = FlowClassifierLib.getDominantDirection(state);
        
        // Map imbalanceBps to healthStatus
        // Centered (0-15%), Leaning (15-30%), Strained (30-50%), Critical (50-70%), Capsizing Risk (70%+)
        if (summary.imbalanceBps < 1500) {
            summary.healthStatus = 0;
        } else if (summary.imbalanceBps < 3000) {
            summary.healthStatus = 1;
        } else if (summary.imbalanceBps < 5000) {
            summary.healthStatus = 2;
        } else if (summary.imbalanceBps < 7000) {
            summary.healthStatus = 3;
        } else {
            summary.healthStatus = 4;
        }
        
        RecoveryVault vault = hook.vault();
        summary.recoveryBudget = vault.poolRecoveryBudget(poolId);
    }

    function previewSwap(
        address hookAddress,
        bytes32 poolId,
        bool zeroForOne
    ) external view returns (SwapPreview memory preview) {
        KeelHook hook = KeelHook(hookAddress);
        (uint256 v0, uint256 v1, ) = hook.poolFlowStates(poolId);
        
        FlowClassifierLib.FlowState memory state = FlowClassifierLib.FlowState({
            token0ToToken1Volume: v0,
            token1ToToken0Volume: v1,
            lastReset: 0
        });
        
        uint256 threshold = hook.neutralThresholdBps();
        (FlowClassifierLib.TradeClass tradeClass, uint256 imbalanceBps) = 
            FlowClassifierLib.classifySwap(state, zeroForOne, threshold);
            
        KeelFeeLib.FeeBreakdown memory breakdown = KeelFeeLib.calculateFee(
            tradeClass,
            imbalanceBps,
            hook.baseFee(),
            hook.minFee(),
            hook.maxFee()
        );
        
        preview.tradeClass = uint8(tradeClass);
        preview.baseFee = breakdown.baseFee;
        preview.toxicSurcharge = breakdown.toxicSurcharge;
        preview.healingDiscount = breakdown.healingDiscount;
        preview.finalFee = breakdown.finalFee;
    }

    function getTraderData(
        address hookAddress,
        bytes32 poolId,
        address trader
    ) external view returns (uint256 creditBalance) {
        KeelHook hook = KeelHook(hookAddress);
        RecoveryVault vault = hook.vault();
        creditBalance = vault.recoveryCredits(poolId, trader);
    }
}
