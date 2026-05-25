const hre = require("hardhat");

const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const X_LAYER_POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
const X_LAYER_POSITION_MANAGER = "0xcf1eafc6928dc385a342e7c6491d371d2871458b";
const X_LAYER_STATE_VIEW = "0x76fd297e2d437cd7f76d50f01afe6160f86e9990";
const X_LAYER_USDG = "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8";

const FLAGS = {
  AFTER_INITIALIZE: 1n << 12n,
  BEFORE_SWAP: 1n << 7n,
  AFTER_SWAP: 1n << 6n,
};

const ALL_HOOK_MASK = (1n << 14n) - 1n;

const REQUIRED_HOOK_FLAGS =
  FLAGS.AFTER_INITIALIZE | FLAGS.BEFORE_SWAP | FLAGS.AFTER_SWAP;

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
    const address = hre.ethers.getCreate2Address(
      CREATE2_DEPLOYER,
      salt,
      initCodeHash
    );

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
    throw new Error(
      `CREATE2 deployer is not available at ${CREATE2_DEPLOYER} on this network`
    );
  }

  const tx = await signer.sendTransaction({
    to: CREATE2_DEPLOYER,
    data: salt + initCode.slice(2),
  });
  const receipt = await tx.wait();

  const deployedCode = await hre.ethers.provider.getCode(expectedAddress);
  if (deployedCode === "0x") {
    throw new Error(`CREATE2 deployment failed: ${expectedAddress} has no code`);
  }

  return { address: expectedAddress, txHash: receipt.hash, alreadyDeployed: false };
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing PRIVATE_KEY for X Layer deployment");
  }

  const deployerAddr = await deployer.getAddress();
  const network = await hre.ethers.provider.getNetwork();

  const baseFee = 3000; // 0.30%
  const minFee = 500; // 0.05%
  const maxFee = 15000; // 1.50%
  const neutralThreshold = 1500; // 15%

  const KeelHook = await hre.ethers.getContractFactory("KeelHook");
  const hookDeployTx = await KeelHook.getDeployTransaction(
    X_LAYER_POOL_MANAGER,
    baseFee,
    minFee,
    maxFee,
    neutralThreshold
  );

  const initCode = hookDeployTx.data;
  const mined = await findSalt(initCode, REQUIRED_HOOK_FLAGS);
  const hookDeployment = await deployViaCreate2(
    deployer,
    mined.salt,
    initCode,
    mined.address
  );

  const hook = KeelHook.attach(hookDeployment.address);
  const vaultAddr = await hook.vault();

  const KeelLens = await hre.ethers.getContractFactory("KeelLens");
  const lens = await KeelLens.deploy();
  await lens.waitForDeployment();
  const lensAddr = await lens.getAddress();

  console.log(JSON.stringify({
    project: "KEEL",
    network: hre.network.name,
    chainId: network.chainId.toString(),
    deployer: deployerAddr,
    uniswapV4: {
      poolManager: X_LAYER_POOL_MANAGER,
      positionManager: X_LAYER_POSITION_MANAGER,
      stateView: X_LAYER_STATE_VIEW,
    },
    hookFlags: {
      required: `0x${REQUIRED_HOOK_FLAGS.toString(16)}`,
      afterInitialize: true,
      beforeSwap: true,
      afterSwap: true,
      minedAttempts: mined.attempts,
      salt: mined.salt,
    },
    contracts: {
      hook: hookDeployment.address,
      hookDeployTx: hookDeployment.txHash,
      recoveryVault: vaultAddr,
      lens: lensAddr,
    },
    tokens: {
      okb: "native X Layer asset",
      usdg: X_LAYER_USDG,
    },
    pool: {
      target: "OKB / USDG",
      note: "Use run-xlayer-mainnet-usdg-proof.js for pool initialization, liquidity, swaps, and proof capture.",
    },
    feeConfig: {
      baseFee,
      minFee,
      maxFee,
      neutralThreshold,
    },
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
