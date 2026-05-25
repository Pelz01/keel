// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";

contract MockPoolManager {
    event SwapExecuted(
        address indexed sender,
        bytes32 indexed poolId,
        bool zeroForOne,
        int256 amountSpecified,
        uint24 appliedFee
    );

    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        returns (BalanceDelta)
    {
        bytes32 poolId = keccak256(abi.encode(key));

        uint24 appliedFee = key.fee;

        if (address(key.hooks) != address(0)) {
            (bytes4 selector, BeforeSwapDelta delta, uint24 dynamicFee) =
                key.hooks.beforeSwap(msg.sender, key, params, hookData);
            selector;
            delta;

            if ((dynamicFee & LPFeeLibrary.OVERRIDE_FEE_FLAG) != 0) {
                appliedFee = dynamicFee & LPFeeLibrary.REMOVE_OVERRIDE_MASK;
            }
        }

        BalanceDelta swapDelta = BalanceDelta.wrap(params.amountSpecified);

        if (address(key.hooks) != address(0)) {
            key.hooks.afterSwap(msg.sender, key, params, swapDelta, hookData);
        }

        emit SwapExecuted(msg.sender, poolId, params.zeroForOne, params.amountSpecified, appliedFee);

        return swapDelta;
    }

    function initializePool(PoolKey calldata key, uint160 sqrtPriceX96, int24 tick, bytes calldata)
        external
    {
        if (address(key.hooks) != address(0)) {
            key.hooks.afterInitialize(msg.sender, key, sqrtPriceX96, tick);
        }
    }
}
