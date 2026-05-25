require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const path = require("path");

const rootEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(rootEnvPath)) {
  const envText = fs.readFileSync(rootEnvPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

const privateKey = process.env.PRIVATE_KEY || "";
const deployerAccounts = /^0x[0-9a-fA-F]{64}$/.test(privateKey) ? [privateKey] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    xLayerTestnet: {
      url: process.env.X_LAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech/terigon",
      chainId: 1952,
      accounts: deployerAccounts
    },
    xLayerMainnet: {
      url: process.env.X_LAYER_MAINNET_RPC_URL || "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: deployerAccounts
    }
  }
};
