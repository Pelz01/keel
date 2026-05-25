const hre = require("hardhat");

async function main() {
  const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32"; // X Layer PoolManager
  
  const SwapExecutor = await hre.ethers.getContractFactory("KeelDemoExecutor");
  const executor = await SwapExecutor.deploy(POOL_MANAGER);
  await executor.waitForDeployment();

  console.log("KEEL swap executor deployed to:", await executor.getAddress());
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
