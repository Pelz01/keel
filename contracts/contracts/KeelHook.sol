// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";

import "./libraries/FlowClassifierLib.sol";
import "./libraries/KeelFeeLib.sol";
import "./RecoveryVault.sol";

contract KeelHook is IHooks {
    using FlowClassifierLib for FlowClassifierLib.FlowState;
    using PoolIdLibrary for PoolKey;

    address public immutable manager;
    RecoveryVault public immutable vault;

    uint24 public baseFee;
    uint24 public minFee;
    uint24 public maxFee;
    uint256 public neutralThresholdBps;

    mapping(bytes32 => FlowClassifierLib.FlowState) public poolFlowStates;

    event KeelPoolInitialized(
        bytes32 indexed poolId,
        uint24 baseFee,
        uint24 minFee,
        uint24 maxFee,
        uint256 neutralThresholdBps
    );

    event FlowUpdated(
        bytes32 indexed poolId,
        uint256 token0ToToken1Volume,
        uint256 token1ToToken0Volume,
        uint256 imbalanceBps,
        uint8 dominantDirection
    );

    event SwapClassified(
        bytes32 indexed poolId,
        address indexed trader,
        uint8 tradeClass,
        uint8 swapDirection,
        uint256 imbalanceBps
    );

    event StabilizationApplied(
        bytes32 indexed poolId,
        address indexed trader,
        uint8 tradeClass,
        uint24 baseFee,
        uint24 toxicSurcharge,
        uint24 healingDiscount,
        uint24 finalFee,
        uint256 recoveryCredit
    );

    event RecoveryCredited(
        bytes32 indexed poolId,
        address indexed trader,
        uint256 amount,
        uint256 newRecoveryCreditBalance
    );

    modifier onlyManager() {
        require(msg.sender == manager, "Caller must be manager");
        _;
    }

    constructor(
        address _manager,
        uint24 _baseFee,
        uint24 _minFee,
        uint24 _maxFee,
        uint256 _neutralThresholdBps
    ) {
        require(_manager != address(0), "Invalid manager address");
        manager = _manager;
        baseFee = _baseFee;
        minFee = _minFee;
        maxFee = _maxFee;
        neutralThresholdBps = _neutralThresholdBps;

        vault = new RecoveryVault(address(this));
    }

    function _poolId(PoolKey calldata key) internal pure returns (bytes32) {
        PoolKey memory keyMemory = key;
        PoolId id = keyMemory.toId();
        return PoolId.unwrap(id);
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata key, uint160, int24)
        external
        override
        onlyManager
        returns (bytes4)
    {
        bytes32 poolId = _poolId(key);
        emit KeelPoolInitialized(poolId, baseFee, minFee, maxFee, neutralThresholdBps);
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        external
        view
        override
        onlyManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        bytes32 poolId = _poolId(key);
        FlowClassifierLib.FlowState memory flowState = poolFlowStates[poolId];

        (FlowClassifierLib.TradeClass tradeClass, uint256 imbalanceBps) =
            flowState.classifySwap(params.zeroForOne, neutralThresholdBps);

        KeelFeeLib.FeeBreakdown memory breakdown =
            KeelFeeLib.calculateFee(tradeClass, imbalanceBps, baseFee, minFee, maxFee);

        uint24 feeWithOverride = LPFeeLibrary.OVERRIDE_FEE_FLAG | breakdown.finalFee;

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, feeWithOverride);
    }

    function afterSwap(address sender, PoolKey calldata key, SwapParams calldata params, BalanceDelta, bytes calldata)
        external
        override
        onlyManager
        returns (bytes4, int128)
    {
        bytes32 poolId = _poolId(key);
        FlowClassifierLib.FlowState storage flowState = poolFlowStates[poolId];

        (FlowClassifierLib.TradeClass tradeClass, uint256 imbalanceBps) =
            flowState.classifySwap(params.zeroForOne, neutralThresholdBps);

        KeelFeeLib.FeeBreakdown memory breakdown =
            KeelFeeLib.calculateFee(tradeClass, imbalanceBps, baseFee, minFee, maxFee);

        uint256 amount =
            params.amountSpecified < 0 ? uint256(-params.amountSpecified) : uint256(params.amountSpecified);

        uint256 recoveryCredit = 0;

        if (tradeClass == FlowClassifierLib.TradeClass.Toxic) {
            uint256 surchargeAmount = (amount * breakdown.toxicSurcharge) / 1_000_000;
            vault.creditSurcharge(poolId, surchargeAmount);
        } else if (tradeClass == FlowClassifierLib.TradeClass.Healing) {
            uint256 rewardAmount = (amount * breakdown.healingDiscount) / 1_000_000;
            recoveryCredit = vault.rewardTrader(poolId, sender, rewardAmount);
        }

        if (params.zeroForOne) {
            flowState.token0ToToken1Volume += amount;
        } else {
            flowState.token1ToToken0Volume += amount;
        }

        uint256 newImbalance = flowState.calculateImbalance();
        (bool zeroForOne, bool hasDominant) = flowState.getDominantDirection();
        uint8 dominantDirection = hasDominant ? (zeroForOne ? 0 : 1) : 2;

        emit SwapClassified(poolId, sender, uint8(tradeClass), params.zeroForOne ? 0 : 1, imbalanceBps);

        emit StabilizationApplied(
            poolId,
            sender,
            uint8(tradeClass),
            breakdown.baseFee,
            breakdown.toxicSurcharge,
            breakdown.healingDiscount,
            breakdown.finalFee,
            recoveryCredit
        );

        if (recoveryCredit > 0) {
            emit RecoveryCredited(poolId, sender, recoveryCredit, vault.recoveryCredits(poolId, sender));
        }

        emit FlowUpdated(
            poolId,
            flowState.token0ToToken1Volume,
            flowState.token1ToToken0Volume,
            newImbalance,
            dominantDirection
        );

        return (IHooks.afterSwap.selector, 0);
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }
}
