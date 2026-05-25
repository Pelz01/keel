# KEEL Mainnet Proof

## Network

- Network: X Layer mainnet
- Chain ID: `196`
- Deployer/burner: `0x9E2ca69C4B6296E36b3249E752948ffB7fE4411A`
- Explorer: `https://www.okx.com/web3/explorer/xlayer`

## Purpose

Validate KEEL against the official X Layer mainnet Uniswap v4 PoolManager with tiny real funds after the X Layer testnet Hook validation passed.

## Official Uniswap v4

- PoolManager: `0x360e68faccca8ca495c1b759fd9eee466db9fb32`
- PositionManager: `0xcf1eafc6928dc385a342e7c6491d371d2871458b`
- StateView: `0x76fd297e2d437cd7f76d50f01afe6160f86e9990`

## Deployed Contracts

- KEEL Hook: `0x5204E843a29DC984BaD071bD1b41780a9B2c90c0`
- RecoveryVault: `0xa70583b7CA9d283CF831dB22F40799c1BAAFC6eE`
- KeelLens: `0x97bC23509E80c41b57225D4Ac1131DCEBB8dA184`
- Swap executor: `0x38900dacc1475e779e4213AEC064716e304e6Cb9`
- PoolManager: `0x360e68faccca8ca495c1b759fd9eee466db9fb32`
- Pool ID: `0x33fb806466dd0ccc969aa38946b5df6f3bd0678662f018805a93492cd9ad84bc`

## Protected Pool

OKB / USDG

## Token Details

- OKB: native X Layer asset
- USDG: `0x4ae46a509f6b1d9056937ba4500cb143933d2dc8`
- USDG decimals: `6`

## Pool Key

```json
{
  "currency0": "0x0000000000000000000000000000000000000000",
  "currency1": "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8",
  "fee": 8388608,
  "tickSpacing": 60,
  "hooks": "0x5204E843a29DC984BaD071bD1b41780a9B2c90c0"
}
```

## Transactions

1. Deploy KEEL Hook: already deployed at `0x5204E843a29DC984BaD071bD1b41780a9B2c90c0`
2. Deploy KeelLens: `0x147130e0b032eb9ad988d4fc80dad0d6250cb48944a9d0d85ceac1cec45ed3ea`
3. Deploy swap executor: `0xde039bdc4d6cd27a6c769add8841a83c589acf188a2229f2bfc385870c1dba97`
4. Create OKB / USDG pool: `0xa63da7e291889aaf5296fd3b07f892ddfe3f27dbf5aa3305ae6eaf1308025f9d`
5. Approve USDG: `0x3593c70066703d382c744461922a27aca0ddd4267dd721e0ddb8846fd31c2303`
6. Add liquidity: `0x8bba0d6d2ffac6129c7f88ff8a11b39813133a4727148c82a93538681b6881e4`
7. Neutral swap: `0xb4fa9fd93d92a7ccd44825ed3ebe500974eef96785e57a8c976c8091e9fbf3d3`
8. Toxic swap: `0xb2670d9ddea8d3f7aa9558b5a2571863f0ce0c33a56f1c246a35e0aed774d974`
9. Healing swap: `0xa139e06b9954087613620165fe78b453be4d57229710ae8a7e4bb74df8d4d00c`

## Final KeelLens State

- token0Volume: `500000000000000`
- token1Volume: `38056`
- imbalanceBps: `9999`
- hasDominantDirection: `true`
- dominantZeroForOne: `true`
- healthStatus: `4`
- recoveryBudget: `2000000000000`
- traderCredits: `0`

## Events Verified

The swap transactions trigger the KEEL Hook and emit real mainnet events:

- `SwapClassified`
- `StabilizationApplied`
- `FlowUpdated`

The healing swap executed onchain. In this dust-sized run the recorded trader credit is `0` because the calculated reward rounds down at the chosen amount.

## Explorer Links

- Hook: https://www.okx.com/web3/explorer/xlayer/address/0x5204E843a29DC984BaD071bD1b41780a9B2c90c0
- RecoveryVault: https://www.okx.com/web3/explorer/xlayer/address/0xa70583b7CA9d283CF831dB22F40799c1BAAFC6eE
- KeelLens: https://www.okx.com/web3/explorer/xlayer/address/0x97bC23509E80c41b57225D4Ac1131DCEBB8dA184
- Swap executor: https://www.okx.com/web3/explorer/xlayer/address/0x38900dacc1475e779e4213AEC064716e304e6Cb9
- Initialize pool: https://www.okx.com/web3/explorer/xlayer/tx/0xa63da7e291889aaf5296fd3b07f892ddfe3f27dbf5aa3305ae6eaf1308025f9d
- Add liquidity: https://www.okx.com/web3/explorer/xlayer/tx/0x8bba0d6d2ffac6129c7f88ff8a11b39813133a4727148c82a93538681b6881e4
- Neutral swap: https://www.okx.com/web3/explorer/xlayer/tx/0xb4fa9fd93d92a7ccd44825ed3ebe500974eef96785e57a8c976c8091e9fbf3d3
- Toxic swap: https://www.okx.com/web3/explorer/xlayer/tx/0xb2670d9ddea8d3f7aa9558b5a2571863f0ce0c33a56f1c246a35e0aed774d974
- Healing swap: https://www.okx.com/web3/explorer/xlayer/tx/0xa139e06b9954087613620165fe78b453be4d57229710ae8a7e4bb74df8d4d00c

## What This Proves

KEEL works on X Layer mainnet with real funds: swaps reach the official Uniswap v4 PoolManager, trigger the KEEL Hook, classify directional flow, update recovery accounting, emit real logs, and expose confirmed state through KeelLens.
