// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// User defined value types for Uniswap v4
type BeforeSwapDelta is int256;
type BalanceDelta is int256;

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
}

interface IHooks {
    function beforeInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        bytes calldata hookData
    ) external returns (bytes4);

    function afterInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24 tick,
        bytes calldata hookData
    ) external returns (bytes4);

    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        address to,
        uint256 amount0Max,
        uint256 amount1Max,
        bytes calldata hookData
    ) external returns (bytes4);

    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        address to,
        uint256 amount0Max,
        uint256 amount1Max,
        bytes calldata hookData
    ) external returns (bytes4);

    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        address to,
        uint256 amount0Min,
        uint256 amount1Min,
        bytes calldata hookData
    ) external returns (bytes4);

    function afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        address to,
        uint256 amount0Min,
        uint256 amount1Min,
        bytes calldata hookData
    ) external returns (bytes4);

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external returns (bytes4, BeforeSwapDelta, uint24);

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external returns (bytes4, int128);

    function beforeDonate(
        address sender,
        PoolKey calldata key,
        uint256 amount0,
        uint256 amount1,
        bytes calldata hookData
    ) external returns (bytes4);

    function afterDonate(
        address sender,
        PoolKey calldata key,
        uint256 amount0,
        uint256 amount1,
        bytes calldata hookData
    ) external returns (bytes4);
}
