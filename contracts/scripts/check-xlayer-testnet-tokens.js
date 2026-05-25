const hre = require("hardhat");

const TOKENS = {
  USDG: "0xa78e2baabaf5c4f36b7fc394725deb68d332eec1",
  USDC: "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d",
  USDT: "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
};

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("Missing PRIVATE_KEY");

  const owner = await signer.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  const nativeBalance = await hre.ethers.provider.getBalance(owner);

  const result = {
    network: hre.network.name,
    chainId: network.chainId.toString(),
    owner,
    nativeBalance: hre.ethers.formatEther(nativeBalance),
    tokens: {},
  };

  for (const [label, address] of Object.entries(TOKENS)) {
    const code = await hre.ethers.provider.getCode(address);
    if (code === "0x") {
      result.tokens[label] = { address, hasCode: false };
      continue;
    }

    const token = new hre.ethers.Contract(address, ERC20_ABI, signer);
    const [name, symbol, decimals, balance] = await Promise.all([
      token.name().catch(() => ""),
      token.symbol().catch(() => label),
      token.decimals(),
      token.balanceOf(owner),
    ]);

    result.tokens[label] = {
      address,
      hasCode: true,
      name,
      symbol,
      decimals: Number(decimals),
      balance: hre.ethers.formatUnits(balance, decimals),
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
