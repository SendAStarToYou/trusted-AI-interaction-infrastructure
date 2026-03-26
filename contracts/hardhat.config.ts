import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  paths: {
    sources: "./contracts",
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
    },
  },
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("INFURA_URL"),
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
});