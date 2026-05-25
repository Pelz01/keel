// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./FlowClassifierLib.sol";

library KeelFeeLib {
    struct FeeBreakdown {
        uint24 baseFee;
        uint24 toxicSurcharge;
        uint24 healingDiscount;
        uint24 finalFee;
        uint256 imbalanceBps;
        FlowClassifierLib.TradeClass tradeClass;
    }

    function calculateFee(
        FlowClassifierLib.TradeClass tradeClass,
        uint256 imbalanceBps,
        uint24 baseFee,
        uint24 minFee,
        uint24 maxFee
    ) internal pure returns (FeeBreakdown memory breakdown) {
        breakdown.baseFee = baseFee;
        breakdown.imbalanceBps = imbalanceBps;
        breakdown.tradeClass = tradeClass;

        if (tradeClass == FlowClassifierLib.TradeClass.Neutral) {
            breakdown.toxicSurcharge = 0;
            breakdown.healingDiscount = 0;
            breakdown.finalFee = baseFee;
        } else if (tradeClass == FlowClassifierLib.TradeClass.Toxic) {
            breakdown.healingDiscount = 0;
            
            if (imbalanceBps < 1500) {
                breakdown.toxicSurcharge = 0;
            } else if (imbalanceBps < 3000) {
                breakdown.toxicSurcharge = 1500; // 0.15%
            } else if (imbalanceBps < 5000) {
                breakdown.toxicSurcharge = 3500; // 0.35%
            } else if (imbalanceBps < 7000) {
                breakdown.toxicSurcharge = 6000; // 0.60%
            } else {
                breakdown.toxicSurcharge = 10000; // 1.00%
            }
            
            uint256 calculatedFee = uint256(baseFee) + breakdown.toxicSurcharge;
            if (calculatedFee > maxFee) {
                breakdown.finalFee = maxFee;
            } else {
                breakdown.finalFee = uint24(calculatedFee);
            }
        } else { // Healing
            breakdown.toxicSurcharge = 0;
            
            if (imbalanceBps < 1500) {
                breakdown.healingDiscount = 0;
            } else if (imbalanceBps < 3000) {
                breakdown.healingDiscount = 500; // 0.05%
            } else if (imbalanceBps < 5000) {
                breakdown.healingDiscount = 1000; // 0.10%
            } else if (imbalanceBps < 7000) {
                breakdown.healingDiscount = 1500; // 0.15%
            } else {
                breakdown.healingDiscount = 2500; // 0.25%
            }
            
            if (uint256(baseFee) <= breakdown.healingDiscount) {
                breakdown.finalFee = minFee;
            } else {
                uint256 calculatedFee = uint256(baseFee) - breakdown.healingDiscount;
                if (calculatedFee < minFee) {
                    breakdown.finalFee = minFee;
                } else {
                    breakdown.finalFee = uint24(calculatedFee);
                }
            }
        }
    }
}
