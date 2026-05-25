const hre = require("hardhat");
const { Pool, Position } = require("@uniswap/v4-sdk");
const { Token, Ether } = require("@uniswap/sdk-core");
const { nearestUsableTick, encodeSqrtRatioX96 } = require("@uniswap/v3-sdk");

const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
const POSITION_MANAGER = "0xcf1eafc6928dc385a342e7c6491d371d2871458b";
const STATE_VIEW = "0x76fd297e2d437cd7f76d50f01afe6160f86e9990";
const USDG = "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8";
const NATIVE_OKB = "0x0000000000000000000000000000000000000000";

const FLAGS = {
  AFTER_INITIALIZE: 1n << 12n,
  BEFORE_SWAP: 1n << 7n,
  AFTER_SWAP: 1n << 6n,
};

const ALL_HOOK_MASK = (1n << 14n) - 1n;
const REQUIRED_HOOK_FLAGS = FLAGS.AFTER_INITIALIZE | FLAGS.BEFORE_SWAP | FLAGS.AFTER_SWAP;

const DYNAMIC_FEE_FLAG = 0x800000;
const TICK_SPACING = 60;
const BASE_FEE = 3000;
const MIN_FEE = 500;
const MAX_FEE = 15000;
const NEUTRAL_THRESHOLD = 1500;
const MIN_SQRT_PRICE_LIMIT = 4295128740n;
const MAX_SQRT_PRICE_LIMIT = 1461446703485210103287273052203988822378723970341n;

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

async function wait(tx, label) {
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${label} reverted: ${receipt.hash}`);
  console.log(`${label}: ${receipt.hash}`);
  return receipt;
}

function hasHookFlags(address, flags) {
  return (BigInt(address) & ALL_HOOK_MASK) === flags;
}

function makeSalt(index) {
  return hre.ethers.zeroPadValue(hre.ethers.toBeHex(index), 32);
}

async function findSalt(initCode, flags, maxAttempts = 5_000_000) {
  const initCodeHash = hre.ethers.keccak256(initCode);

  for (let i = 0; i < maxAttempts; i++) {
    const salt = makeSalt(i);
    const address = hre.ethers.getCreate2Address(CREATE2_DEPLOYER, salt, initCodeHash);

    if (hasHookFlags(address, flags)) {
      return { address, salt, attempts: i + 1 };
    }
  }

  throw new Error(`No hook salt found within ${maxAttempts} attempts`);
}

async function deployViaCreate2(signer, salt, initCode, expectedAddress) {
  const existingCode = await hre.ethers.provider.getCode(expectedAddress);
  if (existingCode !== "0x") {
    return { address: expectedAddress, txHash: null, alreadyDeployed: true };
  }

  const factoryCode = await hre.ethers.provider.getCode(CREATE2_DEPLOYER);
  if (factoryCode === "0x") {
    throw new Error(`CREATE2 deployer is not available at ${CREATE2_DEPLOYER}`);
  }

  const tx = await signer.sendTransaction({
    to: CREATE2_DEPLOYER,
    data: salt + initCode.slice(2),
  });
  const receipt = await wait(tx, "deployHook");

  const deployedCode = await hre.ethers.provider.getCode(expectedAddress);
  if (deployedCode === "0x") {
    throw new Error(`CREATE2 deployment failed: ${expectedAddress} has no code`);
  }

  return { address: expectedAddress, txHash: receipt.hash, alreadyDeployed: false };
}

async function requireCode(name, address) {
  const code = await hre.ethers.provider.getCode(address);
  if (code === "0x") throw new Error(`${name} has no bytecode at ${address}`);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) throw new Error("Missing PRIVATE_KEY");

  const deployerAddr = await deployer.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 196) {
    throw new Error(`Refusing to run this mainnet proof on chain ${chainId}`);
  }

  await requireCode("PoolManager", POOL_MANAGER);
  await requireCode("USDG", USDG);
  await requireCode("CREATE2 deployer", CREATE2_DEPLOYER);

  const nativeBefore = await hre.ethers.provider.getBalance(deployerAddr);
  const usdg = new hre.ethers.Contract(USDG, ERC20_ABI, deployer);
  const usdgDecimals = Number(await usdg.decimals());
  if (usdgDecimals !== 6) throw new Error(`Unexpected USDG decimals: ${usdgDecimals}`);

  const usdgBefore = await usdg.balanceOf(deployerAddr);
  const requiredUsdg = hre.ethers.parseUnits("0.02", usdgDecimals);
  const requiredOkb = hre.ethers.parseEther("0.012");
  if (usdgBefore < requiredUsdg) throw new Error("Not enough USDG for mainnet proof");
  if (nativeBefore < requiredOkb) throw new Error("Not enough OKB for mainnet proof");

  const KeelHook = await hre.ethers.getContractFactory("KeelHook");
  const hookDeployTx = await KeelHook.getDeployTransaction(
    POOL_MANAGER,
    BASE_FEE,
    MIN_FEE,
    MAX_FEE,
    NEUTRAL_THRESHOLD
  );

  const mined = await findSalt(hookDeployTx.data, REQUIRED_HOOK_FLAGS);
  console.log(`Mined hook address ${mined.address} in ${mined.attempts} attempts`);

  const hookDeployment = await deployViaCreate2(deployer, mined.salt, hookDeployTx.data, mined.address);
  const hook = KeelHook.attach(hookDeployment.address);
  const vaultAddr = await hook.vault();

  const KeelLens = await hre.ethers.getContractFactory("KeelLens");
  const lens = await KeelLens.deploy();
  const lensDeployReceipt = await wait(lens.deploymentTransaction(), "deployLens");
  const lensAddr = await lens.getAddress();

  const SwapExecutor = await hre.ethers.getContractFactory("KeelDemoExecutor");
  const executor = await SwapExecutor.deploy(POOL_MANAGER);
  const executorDeployReceipt = await wait(executor.deploymentTransaction(), "deployExecutor");
  const executorAddr = await executor.getAddress();

  const sqrtPriceX96 = encodeSqrtRatioX96(
    hre.ethers.parseUnits("1", usdgDecimals).toString(),
    hre.ethers.parseEther("1").toString()
  ).toString();

  const poolKey = {
    currency0: NATIVE_OKB,
    currency1: USDG,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: TICK_SPACING,
    hooks: hookDeployment.address,
  };

  const poolId = hre.ethers.keccak256(
    hre.ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    )
  );

  const initializeReceipt = await wait(await executor.initialize(poolKey, sqrtPriceX96), "initializePool");

  const okbCurrency = Ether.onChain(chainId);
  const usdgCurrency = new Token(chainId, USDG, usdgDecimals, "USDG", "Global Dollar");
  const pool = new Pool(
    okbCurrency,
    usdgCurrency,
    DYNAMIC_FEE_FLAG,
    TICK_SPACING,
    hookDeployment.address,
    sqrtPriceX96,
    "0",
    -276325
  );

  const tickLower = nearestUsableTick(-887272, TICK_SPACING);
  const tickUpper = nearestUsableTick(887272, TICK_SPACING);
  const position = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0: hre.ethers.parseEther("0.003").toString(),
    amount1: hre.ethers.parseUnits("0.3", usdgDecimals).toString(),
    useFullPrecision: true,
  });

  const amount0ForLiquidity = BigInt(position.mintAmounts.amount0.toString());
  const amount1ForLiquidity = BigInt(position.mintAmounts.amount1.toString());

  const approveReceipt = await wait(await usdg.approve(executorAddr, hre.ethers.MaxUint256), "approveUSDG");

  const liquidityParams = {
    tickLower,
    tickUpper,
    liquidityDelta: position.liquidity.toString(),
    salt: hre.ethers.ZeroHash,
  };

  const liquidityReceipt = await wait(
    await executor.addLiquidity(poolKey, liquidityParams, "0x", { value: amount0ForLiquidity }),
    "addLiquidity"
  );

  const neutralSwapAmount = hre.ethers.parseEther("0.0003");
  const toxicSwapAmount = hre.ethers.parseEther("0.0002");
  const healingSwapAmount = hre.ethers.parseUnits("0.0003", usdgDecimals);

  const neutralSwapReceipt = await wait(
    await executor.swap(
      poolKey,
      {
        zeroForOne: true,
        amountSpecified: -neutralSwapAmount,
        sqrtPriceLimitX96: MIN_SQRT_PRICE_LIMIT,
      },
      "0x",
      { value: neutralSwapAmount }
    ),
    "neutralSwap"
  );

  const toxicSwapReceipt = await wait(
    await executor.swap(
      poolKey,
      {
        zeroForOne: true,
        amountSpecified: -toxicSwapAmount,
        sqrtPriceLimitX96: MIN_SQRT_PRICE_LIMIT,
      },
      "0x",
      { value: toxicSwapAmount }
    ),
    "toxicSwap"
  );

  const healingSwapReceipt = await wait(
    await executor.swap(
      poolKey,
      {
        zeroForOne: false,
        amountSpecified: -healingSwapAmount,
        sqrtPriceLimitX96: MAX_SQRT_PRICE_LIMIT,
      },
      "0x"
    ),
    "healingSwap"
  );

  const summary = await lens.getPoolSummary(hookDeployment.address, poolId);
  const credits = await lens.getTraderData(hookDeployment.address, poolId, executorAddr);

  const nativeAfter = await hre.ethers.provider.getBalance(deployerAddr);
  const usdgAfter = await usdg.balanceOf(deployerAddr);

  console.log(
    JSON.stringify(
      {
        project: "KEEL",
        network: hre.network.name,
        chainId: network.chainId.toString(),
        deployer: deployerAddr,
        officialUniswapV4: {
          poolManager: POOL_MANAGER,
          positionManager: POSITION_MANAGER,
          stateView: STATE_VIEW,
        },
        contracts: {
          hook: hookDeployment.address,
          hookDeployTx: hookDeployment.txHash,
          recoveryVault: vaultAddr,
          lens: lensAddr,
          lensDeployTx: lensDeployReceipt.hash,
          swapExecutor: executorAddr,
          executorDeployTx: executorDeployReceipt.hash,
          usdg: USDG,
        },
        hookFlags: {
          required: `0x${REQUIRED_HOOK_FLAGS.toString(16)}`,
          minedAttempts: mined.attempts,
          salt: mined.salt,
        },
        pool: {
          pair: "OKB / USDG",
          poolId,
          poolKey,
          sqrtPriceX96,
          tickLower,
          tickUpper,
          liquidity: position.liquidity.toString(),
          amount0OkbUsedForLiquidity: hre.ethers.formatEther(amount0ForLiquidity),
          amount1UsdgUsedForLiquidity: hre.ethers.formatUnits(amount1ForLiquidity, usdgDecimals),
        },
        transactions: {
          initialize: initializeReceipt.hash,
          approveUSDG: approveReceipt.hash,
          addLiquidity: liquidityReceipt.hash,
          neutralSwap: neutralSwapReceipt.hash,
          toxicSwap: toxicSwapReceipt.hash,
          healingSwap: healingSwapReceipt.hash,
        },
        liveHookState: {
          token0ToToken1Volume: summary[0].toString(),
          token1ToToken0Volume: summary[1].toString(),
          imbalanceBps: summary[2].toString(),
          hasDominantDirection: summary[3],
          dominantZeroForOne: summary[4],
          healthStatus: summary[5].toString(),
          recoveryBudget: summary[6].toString(),
          executorCredits: credits.toString(),
        },
        balances: {
          nativeBefore: hre.ethers.formatEther(nativeBefore),
          nativeAfter: hre.ethers.formatEther(nativeAfter),
          usdgBefore: hre.ethers.formatUnits(usdgBefore, usdgDecimals),
          usdgAfter: hre.ethers.formatUnits(usdgAfter, usdgDecimals),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
