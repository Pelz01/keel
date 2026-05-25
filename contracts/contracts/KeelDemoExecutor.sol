// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TransientStateLibrary} from "@uniswap/v4-core/src/libraries/TransientStateLibrary.sol";

contract KeelDemoExecutor is IUnlockCallback {
    using TransientStateLibrary for IPoolManager;

    enum Action {
        ModifyLiquidity,
        Swap
    }

    IPoolManager public immutable manager;

    event DemoPoolInitialized(bytes32 indexed poolId, int24 tick);
    event DemoLiquidityAdded(bytes32 indexed poolId, BalanceDelta delta);
    event DemoSwapExecuted(bytes32 indexed poolId, bool zeroForOne, int256 amountSpecified, BalanceDelta delta);

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    receive() external payable {}

    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick) {
        tick = manager.initialize(key, sqrtPriceX96);
        emit DemoPoolInitialized(keccak256(abi.encode(key)), tick);
    }

    function addLiquidity(PoolKey calldata key, ModifyLiquidityParams calldata params, bytes calldata hookData)
        external
        payable
        returns (BalanceDelta delta)
    {
        delta = abi.decode(
            manager.unlock(abi.encode(Action.ModifyLiquidity, msg.sender, key, abi.encode(params), hookData)),
            (BalanceDelta)
        );
        emit DemoLiquidityAdded(keccak256(abi.encode(key)), delta);
    }

    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        payable
        returns (BalanceDelta delta)
    {
        delta =
            abi.decode(manager.unlock(abi.encode(Action.Swap, msg.sender, key, abi.encode(params), hookData)), (BalanceDelta));
        emit DemoSwapExecuted(keccak256(abi.encode(key)), params.zeroForOne, params.amountSpecified, delta);
    }

    function unlockCallback(bytes calldata rawData) external override returns (bytes memory) {
        require(msg.sender == address(manager), "Only PoolManager");

        (Action action, address payer, PoolKey memory key, bytes memory paramsData, bytes memory hookData) =
            abi.decode(rawData, (Action, address, PoolKey, bytes, bytes));

        BalanceDelta delta;
        if (action == Action.ModifyLiquidity) {
            ModifyLiquidityParams memory params = abi.decode(paramsData, (ModifyLiquidityParams));
            (delta,) = manager.modifyLiquidity(key, params, hookData);
        } else {
            SwapParams memory params = abi.decode(paramsData, (SwapParams));
            delta = manager.swap(key, params, hookData);
        }

        _settleOrTake(key.currency0, payer);
        _settleOrTake(key.currency1, payer);

        return abi.encode(delta);
    }

    function _settleOrTake(Currency currency, address payer) internal {
        int256 delta = manager.currencyDelta(address(this), currency);
        if (delta < 0) {
            _settle(currency, payer, uint256(-delta));
        } else if (delta > 0) {
            manager.take(currency, payer, uint256(delta));
        }
    }

    function _settle(Currency currency, address payer, uint256 amount) internal {
        if (Currency.unwrap(currency) == address(0)) {
            manager.settle{value: amount}();
        } else {
            manager.sync(currency);
            IERC20Minimal(Currency.unwrap(currency)).transferFrom(payer, address(manager), amount);
            manager.settle();
        }
    }
}
