# KEEL X Layer Testnet Proof

This is the current low-risk proof deployment for the OKB / USDG KEEL flow.

## Network

- Network: X Layer testnet
- Chain ID: `1952`
- Wallet/deployer: `0xa14e51947bb96c2f88e7436cE4A573b27a6F03ab`
- Explorer: `https://www.okx.com/web3/explorer/xlayer-test`

## Contracts

- Test PoolManager: `0x6540Ce1ebd8565B93c4999a7e0148E268ac2e35C`
- KEEL Hook: `0xD2bbA483F4fBc9d5D4CC496B3235b6491E3090C0`
- RecoveryVault: `0x6E9b43392E2B4f3F28C2A372Cd8962BBe19376A7`
- KeelLens: `0x7BdE453FB27181c661A5a81461d3AC3815Cc1982`
- Swap executor: `0x5F900816fE0557660d745E0285F967e77834E5A3`
- USDG testnet token: `0xa78e2baabaf5c4f36b7fc394725deb68d332eec1`

## Pool

- Pair: OKB / USDG
- Pool ID: `0xa98bf4df64052f4c5b247dd4cf6758af144a37e17569b0142aa26284ee822bce`
- Dynamic fee flag: `8388608`
- Tick spacing: `60`
- Hook flag mask: `0x10c0`

## Transactions

- Hook deploy: `0xe722a814492961e5b63a41fddd723e902449f5174beb5fd6b34f869c5f5e1521`
- Initialize pool: `0xb080ab7fe2a8d003a79171c44d710836cca8fddf46a9824c4af4de9220653b93`
- Add liquidity: `0xb3a4d5ec6b0c5b82b2531cd7f98e5681a7385963760dfc6cce18430bed00f4c6`
- Neutral swap: `0x10b10a631316f62d4db55a9f2b0700afb3359672a8d259d34de9faef0bcd36f6`
- Toxic swap: `0xffd04ba20910ceb3d2f2974cb9ad568463da009c9ba5a8fe6ce102fe3e6e9686`
- Healing swap: `0xb390fa70fc5e97c88ff64f33acaac625a59a77afde769dc2f24b5bfd6f973a64`

## Final Hook State

- token0ToToken1Volume: `8000000000000000`
- token1ToToken0Volume: `5000`
- imbalanceBps: `9999`
- dominantZeroForOne: `true`
- recoveryBudget: `29999999999988`
- executorCredits: `12`

## Notes

This testnet deployment uses a freshly deployed PoolManager because the known official Uniswap v4 PoolManager addresses have no code on X Layer testnet. Mainnet submission should still use the official X Layer v4 PoolManager.
