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

  // 添加域名到白名单
  const domains = ["dashscope.aliyuncs.com", "httpbin.org", "api.github.com"];

  for (const domain of domains) {
    console.log(`添加域名: ${domain}`);
    const tx = await contract.createPendingOperation(domain, true);
    await tx.wait();
    console.log(`✅ ${domain} 已添加 (tx: ${tx.hash})`);

    // 执行操作
    const opId = await contract.operationCount() - 1n;
    console.log(`执行操作 ID: ${opId}`);
    const execTx = await contract.executeOperation(opId);
    await execTx.wait();
    console.log(`✅ 操作已执行 (tx: ${execTx.hash})`);
  }

  console.log("\n所有域名已添加到白名单!");
}

main().catch(console.error);