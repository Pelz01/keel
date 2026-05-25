const hre = require("hardhat");

const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

const ADDRESSES = {
  PoolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
  PositionDescriptor: "0x9e9fbbef0e1bd752e83de5acff3d0c936a9e5a4b",
  PositionManager: "0xcf1eafc6928dc385a342e7c6491d371d2871458b",
  Quoter: "0x8928074ca1b241d8ec02815881c1af11e8bc5219",
  StateView: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990",
  UniversalRouter: "0xda00ae15d3a71466517129255255db7c0c0956d3",
  Permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  USDG: "0x4ae46a509f6b1d9056937ba4500cb143933d2dc8",
  USDT: "0x1e4a5963abfd975d8c9021ce480b42188849d41d",
  USDC: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
};

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
];

async function tokenInfo(address, owner) {
  const token = new hre.ethers.Contract(address, ERC20_ABI, hre.ethers.provider);
  const [name, symbol, decimals, balance] = await Promise.all([
    token.name().catch(() => ""),
    token.symbol().catch(() => ""),
    token.decimals(),
    token.balanceOf(owner),
  ]);

  return {
    name,
    symbol,
    decimals: Number(decimals),
    balanceRaw: balance.toString(),
    balance: hre.ethers.formatUnits(balance, decimals),
  };
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("Missing PRIVATE_KEY");

  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 196) {
    throw new Error(`Refusing mainnet preflight on chain ${chainId}`);
  }

  const deployer = await signer.getAddress();
  const nativeBalance = await hre.ethers.provider.getBalance(deployer);
  const result = {
    project: "KEEL",
    purpose: "Read-only X Layer mainnet preflight",
    network: hre.network.name,
    chainId,
    deployer,
    nativeOkbBalance: hre.ethers.formatEther(nativeBalance),
    create2Deployer: {
      address: CREATE2_DEPLOYER,
      codeBytes: 0,
      hasCode: false,
    },
    contracts: {},
    tokens: {},
    readiness: {
      ok: true,
      warnings: [],
    },
  };

  const create2Code = await hre.ethers.provider.getCode(CREATE2_DEPLOYER);
  result.create2Deployer.codeBytes = create2Code === "0x" ? 0 : (create2Code.length - 2) / 2;
  result.create2Deployer.hasCode = create2Code !== "0x";
  if (!result.create2Deployer.hasCode) {
    result.readiness.ok = false;
    result.readiness.warnings.push("CREATE2 deployer has no code");
  }

  for (const [name, address] of Object.entries(ADDRESSES)) {
    const code = await hre.ethers.provider.getCode(address);
    const codeBytes = code === "0x" ? 0 : (code.length - 2) / 2;

    if (["USDG", "USDT", "USDC"].includes(name)) {
      result.tokens[name] = {
        address,
        codeBytes,
        hasCode: code !== "0x",
        ...(code === "0x" ? {} : await tokenInfo(address, deployer)),
      };
    } else {
      result.contracts[name] = {
        address,
        codeBytes,
        hasCode: code !== "0x",
      };
    }

    if (code === "0x") {
      result.readiness.ok = false;
      result.readiness.warnings.push(`${name} has no code at ${address}`);
    }
  }

  if (result.tokens.USDG?.decimals !== 6) {
    result.readiness.ok = false;
    result.readiness.warnings.push(`USDG decimals expected 6, got ${result.tokens.USDG?.decimals}`);
  }

  if (nativeBalance < hre.ethers.parseEther("0.05")) {
    result.readiness.warnings.push("Native OKB balance is below 0.05 OKB; mainnet proof may fail or leave no retry buffer");
  }

  const usdgBalance = BigInt(result.tokens.USDG?.balanceRaw || "0");
  if (usdgBalance < hre.ethers.parseUnits("0.25", 6)) {
    result.readiness.warnings.push("USDG balance is below 0.25; mainnet proof may fail or leave no retry buffer");
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
