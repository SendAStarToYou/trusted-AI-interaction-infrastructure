import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// 测试调用合约 verifyAndStoreContent
async function main() {
  console.log("Testing contract call with ethers.js...\n");

  const privateKey = process.env.PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  const contractAddress = process.env.CONTRACT_ADDRESS || "0x0281147d66d4b49a60a18210ea2bc61c4af6e8f6";

  // 加载ABI
  const abiPath = path.join(process.cwd(), "../abi/TLSNContentVerifierWithMultisig.json");
  const artifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  const contract = new ethers.Contract(contractAddress, artifact.abi, wallet);

  // 准备测试参数
  const contentHash = ethers.keccak256(ethers.toUtf8Bytes("testprompttestcontent"));
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes("dashscope.aliyuncs.com"));
  const cid = "QmTest123456789";
  const requestId = "test-request-123";
  const fullPrompt = "testprompt";
  const proofBytes = "0x".padEnd(2099 * 2 + 2, "ab"); // 模拟2099字节的证明

  console.log("Parameters:");
  console.log("  contentHash:", contentHash);
  console.log("  cid:", cid);
  console.log("  requestId:", requestId);
  console.log("  fullPrompt:", fullPrompt);
  console.log("  proof length:", proofBytes.length / 2 - 1, "bytes");
  console.log("  expectedContentHash:", contentHash);
  console.log("  domainHash:", domainHash);

  try {
    console.log("\nCalling verifyAndStoreContent...");

    // 使用合约调用
    const tx = await contract.verifyAndStoreContent(
      contentHash,
      cid,
      requestId,
      fullPrompt,
      proofBytes,
      contentHash,
      domainHash
    );

    console.log("✅ Transaction sent!");
    console.log("  Hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());

  } catch (error) {
    console.error("\n❌ Error:", error.message || error);
    if (error.reason) console.error("  Reason:", error.reason);
    if (error.code) console.error("  Code:", error.code);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });