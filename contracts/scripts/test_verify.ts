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
  console.log("Domain hash:", domainHash);

  // 直接调用 verifyAndStoreContent 但只传递最小参数来测试
  const contentHash = ethers.keccak256(Buffer.from("test"));
  const cid = "QmTest123";
  const requestId = "test_req";
  const fullPrompt = "test prompt";
  const proof = "0x" + "00".repeat(488);

  try {
    // 先检查域名
    const isWhitelisted = await contract.whitelistedDomains(domainHash);
    console.log("Is whitelisted:", isWhitelisted);

    // 模拟调用
    const tx = await contract.verifyAndStoreContent(
      contentHash,
      cid,
      requestId,
      fullPrompt,
      proof,
      contentHash,
      domainHash,
      { gasLimit: 500000 }
    );
    console.log("Transaction:", tx.hash);
    await tx.wait();
    console.log("Success!");
  } catch (e: any) {
    console.log("Error:", e.message || e);
  }
}

main().catch(console.error);