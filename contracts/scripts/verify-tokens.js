const hre = require("hardhat");

async function main() {
  const usdtAddress = "0x1e4a5963abfd975d8c9021ce480b42188849d41d";
  const usdcAddress = "0x74b7F16337b8972027F6196A17a631aC6dE26d22";
  const usdgAddress = "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8";

  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];

  const provider = hre.ethers.provider;

  console.log("Querying X Layer Mainnet via Hardhat RPC provider...");

  for (const [label, addr] of [
    ["USDT", usdtAddress],
    ["USDC", usdcAddress],
    ["USDG", usdgAddress]
  ]) {
    try {
      const code = await provider.getCode(addr);
      if (code === "0x") {
        console.log(`\n[${label}] at ${addr}: CONTRACT NOT DEPLOYED`);
        continue;
      }
      const contract = new hre.ethers.Contract(addr, abi, provider);
      const name = await contract.name();
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      console.log(`\n[${label}] Verified:`);
      console.log(`  Name: ${name}`);
      console.log(`  Symbol: ${symbol}`);
      console.log(`  Decimals: ${decimals}`);
      console.log(`  Address: ${addr}`);
    } catch (err) {
      console.log(`\nFailed to verify ${label} at ${addr}:`, err.message);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
