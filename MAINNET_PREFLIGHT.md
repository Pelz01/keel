# KEEL Mainnet Preflight

This file is the checklist before any mainnet write transaction.

## Network

- Network: X Layer mainnet
- Chain ID: `196` / `0xC4`
- RPC: `https://rpc.xlayer.tech`
- Explorer: `https://www.okx.com/web3/explorer/xlayer`
- Gas token: native OKB

Source: https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/network-information

## Official Uniswap v4 X Layer Addresses

- PoolManager: `0x360e68faccca8ca495c1b759fd9eee466db9fb32`
- PositionDescriptor: `0x9e9fbbef0e1bd752e83de5acff3d0c936a9e5a4b`
- PositionManager: `0xcf1eafc6928dc385a342e7c6491d371d2871458b`
- Quoter: `0x8928074ca1b241d8ec02815881c1af11e8bc5219`
- StateView: `0x76fd297e2d437cd7f76d50f01afe6160f86e9990`
- Universal Router: `0xda00ae15d3a71466517129255255db7c0c0956d3`
- Permit2: `0x000000000022d473030f116ddee9f6b43ac78ba3`

Source: https://developers.uniswap.org/docs/protocols/v4/deployments

## X Layer Token Addresses

- OKB: native X Layer gas token
- USDG: `0x4ae46a509f6b1D9056937BA4500cb143933D2dc8`
- USDT: `0x1E4a5963aBFD975d8c9021ce480b42188849D41d`
- USDC: `0x74b7F16337b8972027F6196A17a631aC6dE26d22`

Source: https://web3.okx.com/xlayer/docs/developer/build-on-xlayer/contracts

## Read-Only Preflight Command

Run this before deploying:

```bash
cd contracts
npx hardhat run scripts/preflight-xlayer-mainnet.js --network xLayerMainnet
```

The script checks:

- connected chain is `196`
- deployer address and OKB balance
- CREATE2 deployer has bytecode
- official Uniswap v4 contracts have bytecode
- USDG/USDT/USDC have bytecode
- USDG symbol/name/decimals/balance
- whether the burner has enough dust balance for a tiny proof

## Safety Rules

- Use a fresh burner wallet.
- Do not reuse the existing `.env` key for meaningful funds.
- Fund only tiny OKB and tiny USDG.
- Do not run the mainnet proof script unless the preflight returns no critical warnings.
- Keep the mainnet proof to one pool: OKB / USDG.

## Next Write Path

After preflight passes:

1. Deploy KEEL Hook against official PoolManager.
2. Read RecoveryVault from the Hook.
3. Deploy KeelLens.
4. Deploy swap executor if official periphery is not used.
5. Create OKB / USDG pool.
6. Add tiny liquidity.
7. Run neutral, toxic, and healing swaps.
8. Save output to `MAINNET_PROOF.md`.
