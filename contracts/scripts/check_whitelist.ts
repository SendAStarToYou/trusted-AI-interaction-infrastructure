import "dotenv/config";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

const INFURA_URL = process.env.INFURA_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

async function main() {
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(INFURA_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // 加载合约ABI
  const abi = JSON.parse(fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8")).abi;

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

  const domain = "dashscope.aliyuncs.com";
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes(domain));
  const whitelisted = await contract.whitelistedDomains(domainHash);

  console.log("Domain:", domain);
  console.log("Domain Hash:", domainHash);
  console.log("Whitelisted:", whitelisted);

  // 检查所有操作
  const opCount = await contract.operationCount();
  console.log("Operation count:", opCount);
}

main().catch(console.error);