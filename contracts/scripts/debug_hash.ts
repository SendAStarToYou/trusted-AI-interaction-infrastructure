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

  // 方法1: Rust 使用的 hash (keccak256 of raw bytes)
  const hash1 = ethers.keccak256(Buffer.from(domain));
  console.log("Method 1 (Rust):", hash1);

  // 方法2: Solidity keccak256(bytes(s))
  // In solidity: bytes(s) = raw bytes of string (no length prefix)
  const hash2 = ethers.keccak256(ethers.toUtf8Bytes(domain));
  console.log("Method 2 (toUtf8Bytes):", hash2);

  // 方法3: Using bytes() encoding
  const encoder = new ethers.AbiCoder();
  const encoded = encoder.encode(["bytes"], [Buffer.from(domain)]);
  const hash3 = ethers.keccak256(encoded);
  console.log("Method 3 (bytes encoding):", hash3);

  // Check what's stored
  const storedHash = await contract.whitelistedDomains(hash2);
  console.log("Whitelisted (hash2):", storedHash);

  const storedHash1 = await contract.whitelistedDomains(hash1);
  console.log("Whitelisted (hash1):", storedHash1);
}

main().catch(console.error);