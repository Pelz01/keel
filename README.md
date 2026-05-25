# KEEL

Self-stabilizing liquidity for volatile Uniswap v4 pools.

KEEL is a Hook mechanism that tracks directional swap flow, classifies each trade as `Neutral`, `Toxic`, or `Healing`, and changes the LP fee before execution. Toxic trades that continue one-sided flow pay dynamic drag. Healing trades that move against the dominant flow earn fee relief and recovery credits funded by the toxic surcharge.

## Core Thesis

```text
Toxic flow funds corrective flow.
```

## Why KEEL Matters

Hook the Future requires projects to be built around Uniswap v4 Hooks and deployed on X Layer. KEEL is designed as a pool-level inventory protection layer for volatile X Layer pools where LPs face repeated one-sided flow.

Judging strengths:

- **Innovation:** flow quality becomes a native pool input, not just price movement.
- **Market potential:** useful for launch tokens, volatile assets, thin pools, and LPs seeking inventory defense.
- **Completion:** the repo includes Hook logic, fee classification, recovery accounting, tests, a product dashboard, and deployment scaffolding.
- **Verifiability:** the Hook emits explicit events for AI and human judges.

## What Was Built

- A Uniswap v4 Hook that classifies swaps as `Neutral`, `Toxic`, or `Healing`.
- Dynamic LP fee logic that adds drag to imbalance-expanding flow and discounts corrective flow.
- Recovery accounting that tracks pool recovery budget and trader credits.
- A read helper, `KeelLens`, for pool state, recovery state, and app reads.
- A swap executor used for the OKB / USDG protected pool flow.
- A product app for swap preview, pool health, recovery vault state, and Hook event logs.

## Onchain Verification

KEEL is live-tested on X Layer mainnet with OKB / USDG using the official Uniswap v4 PoolManager.

- Mainnet proof: [MAINNET_PROOF.md](./MAINNET_PROOF.md)
- Testnet rehearsal: [TESTNET_PROOF.md](./TESTNET_PROOF.md)
- Mainnet PoolManager: `0x360e68faccca8ca495c1b759fd9eee466db9fb32`
- KEEL Hook: `0x5204E843a29DC984BaD071bD1b41780a9B2c90c0`
- OKB / USDG Pool ID: `0x33fb806466dd0ccc969aa38946b5df6f3bd0678662f018805a93492cd9ad84bc`

To verify independently, inspect the transaction hashes in [MAINNET_PROOF.md](./MAINNET_PROOF.md) and query Hook events with `eth_getLogs` against the X Layer mainnet RPC.

## Mechanism

The Hook stores recent directional flow per pool:

```solidity
token0ToToken1Volume
token1ToToken0Volume
```

It computes imbalance:

```text
imbalanceBps = abs(flowA - flowB) * 10_000 / totalFlow
```

Classification:

- `Neutral`: imbalance below `1500` bps.
- `Toxic`: incoming swap continues the dominant flow direction.
- `Healing`: incoming swap moves against the dominant flow direction.

Fee:

```text
finalFee = clamp(baseFee + toxicSurcharge - healingDiscount, minFee, maxFee)
```

MVP parameters:

- `baseFee`: `0.30%`
- `minFee`: `0.05%`
- `maxFee`: `1.50%`
- `neutralThreshold`: `15%`

## Contracts

Core files:

- `contracts/contracts/KeelHook.sol`
- `contracts/contracts/RecoveryVault.sol`
- `contracts/contracts/KeelLens.sol`
- `contracts/contracts/libraries/FlowClassifierLib.sol`
- `contracts/contracts/libraries/KeelFeeLib.sol`

Local harness:

- `contracts/contracts/test/MockPoolManager.sol`
- `contracts/contracts/test/MockERC20.sol`

Hook events:

- `KeelPoolInitialized`
- `SwapClassified`
- `StabilizationApplied`
- `RecoveryCredited`
- `FlowUpdated`

## Frontend

The Vite app includes:

- OKB / USDG swap preview
- OKB / USDG pool health
- Keel Axis imbalance monitor
- swap classification preview
- dynamic fee breakdown
- recovery vault budget and user credits
- operational Hook event stream from transaction receipts and `eth_getLogs`

Confirmed values are read from deployed contracts, transaction receipts, and emitted events. The frontend may estimate a swap before execution, but post-transaction state comes from onchain reads and Hook logs.

Run it:

```bash
cd frontend
npm install
npm run dev
```

Build it:

```bash
cd frontend
npm run build
```

## Contracts Commands

Install:

```bash
cd contracts
npm install
```

Test:

```bash
cd contracts
npm test
```

Deploy local harness:

```bash
cd contracts
npx hardhat run scripts/deploy.js
```

Deploy to X Layer testnet:

```bash
cd contracts
$env:PRIVATE_KEY="0x..."
npx hardhat run scripts/deploy.js --network xLayerTestnet
```

Deploy to X Layer mainnet:

```bash
cd contracts
$env:PRIVATE_KEY="0x..."
npx hardhat run scripts/deploy-xlayer-hook.js --network xLayerMainnet
```

X Layer RPC targets are configured in `contracts/hardhat.config.js`:

- testnet chain ID `1952`, RPC `https://testrpc.xlayer.tech/terigon`
- mainnet chain ID `196`, RPC `https://rpc.xlayer.tech`

The production X Layer script mines a CREATE2 Hook address with the Uniswap v4 permission bits for `afterInitialize`, `beforeSwap`, and `afterSwap`. This is required because v4 PoolManager decides which Hook methods to call from the Hook address flags.

Current official Uniswap v4 X Layer mainnet addresses:

- PoolManager: `0x360e68faccca8ca495c1b759fd9eee466db9fb32`
- PositionManager: `0xcf1eafc6928dc385a342e7c6491d371d2871458b`
- StateView: `0x76fd297e2d437cd7f76d50f01afe6160f86e9990`

## Verification Status

KEEL has been validated with real onchain transactions on X Layer.

- Testnet rehearsal completed on X Layer testnet. See [TESTNET_PROOF.md](./TESTNET_PROOF.md).
- Mainnet validation completed on X Layer mainnet. See [MAINNET_PROOF.md](./MAINNET_PROOF.md).
- KEEL Hook deployed on X Layer mainnet:
  [`0x5204E843a29DC984BaD071bD1b41780a9B2c90c0`](https://www.okx.com/web3/explorer/xlayer/address/0x5204E843a29DC984BaD071bD1b41780a9B2c90c0).
- OKB / USDG protected pool created:
  `0x33fb806466dd0ccc969aa38946b5df6f3bd0678662f018805a93492cd9ad84bc`.
- Pool initialization transaction:
  [`0xa63da7e291889aaf5296fd3b07f892ddfe3f27dbf5aa3305ae6eaf1308025f9d`](https://www.okx.com/web3/explorer/xlayer/tx/0xa63da7e291889aaf5296fd3b07f892ddfe3f27dbf5aa3305ae6eaf1308025f9d).
- Toxic swap verified:
  [`0xb2670d9ddea8d3f7aa9558b5a2571863f0ce0c33a56f1c246a35e0aed774d974`](https://www.okx.com/web3/explorer/xlayer/tx/0xb2670d9ddea8d3f7aa9558b5a2571863f0ce0c33a56f1c246a35e0aed774d974).
- Healing swap verified:
  [`0xa139e06b9954087613620165fe78b453be4d57229710ae8a7e4bb74df8d4d00c`](https://www.okx.com/web3/explorer/xlayer/tx/0xa139e06b9954087613620165fe78b453be4d57229710ae8a7e4bb74df8d4d00c).

The live app is configured for the OKB / USDG protected pool. OKB / USDC and OKB / USDT are marked coming soon in the app.

## Demo Walkthrough

Most AMMs are passive. They execute trades, but they do not understand whether flow is healthy or toxic.

KEEL is a Uniswap v4 Hook that makes pools self-stabilizing.

When a swap worsens pool imbalance, KEEL classifies it as toxic and raises the fee. That surcharge builds a recovery budget.

When a swap restores balance, KEEL classifies it as healing, reduces the fee, and credits a recovery reward.

The result is simple: toxic flow funds corrective flow, and the pool starts defending itself onchain.
