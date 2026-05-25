const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  
  // Local-only PoolManager harness for contract development.
  const MockPoolManager = await hre.ethers.getContractFactory("MockPoolManager");
  const manager = await MockPoolManager.deploy();
  await manager.waitForDeployment();
  const managerAddr = await manager.getAddress();
  
  // Keel Hook settings
  const baseFee = 3000; // 0.30%
  const minFee = 500; // 0.05%
  const maxFee = 15000; // 1.50%
  const neutralThreshold = 1500; // 15%
  const dynamicFeeFlag = 0x800000;
  
  // Deploy KeelHook
  const KeelHook = await hre.ethers.getContractFactory("KeelHook");
  const hook = await KeelHook.deploy(
    managerAddr,
    baseFee,
    minFee,
    maxFee,
    neutralThreshold
  );
  await hook.waitForDeployment();
  const hookAddr = await hook.getAddress();
  
  // Deploy KeelLens
  const KeelLens = await hre.ethers.getContractFactory("KeelLens");
  const lens = await KeelLens.deploy();
  await lens.waitForDeployment();
  const lensAddr = await lens.getAddress();
  
  // Local-only ERC20 currencies. KEEL is the hook protocol, not a token.
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const volatileToken = await MockERC20.deploy("Local Volatile Asset", "LVOL", 18);
  await volatileToken.waitForDeployment();
  
  const stableToken = await MockERC20.deploy("Local Stable Asset", "LUSD", 6);
  await stableToken.waitForDeployment();
  
  const vaultAddr = await hook.vault();

  const volatileAddr = await volatileToken.getAddress();
  const stableAddr = await stableToken.getAddress();
  const poolKey = {
    currency0: volatileAddr.toLowerCase() < stableAddr.toLowerCase() ? volatileAddr : stableAddr,
    currency1: volatileAddr.toLowerCase() < stableAddr.toLowerCase() ? stableAddr : volatileAddr,
    fee: dynamicFeeFlag,
    tickSpacing: 60,
    hooks: hookAddr,
  };

  const encodedKey = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  );
  const poolId = hre.ethers.keccak256(encodedKey);

  console.log(JSON.stringify({
    project: "KEEL",
    network: hre.network.name,
    chainId: network.chainId.toString(),
    deployer: deployerAddr,
    contracts: {
      poolManager: managerAddr,
      hook: hookAddr,
      recoveryVault: vaultAddr,
      lens: lensAddr,
      volatileToken: volatileAddr,
      stableToken: stableAddr
    },
    pool: {
      poolId,
      poolKey
    },
    feeConfig: {
      baseFee,
      minFee,
      maxFee,
      neutralThreshold,
      dynamicFeeFlag
    }
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
