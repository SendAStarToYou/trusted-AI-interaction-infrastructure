import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";

const INFURA_URL = process.env.INFURA_URL;
const ADMIN1_KEY = process.env.ADMIN1_PRIVATE_KEY;
const ADMIN2_KEY = process.env.ADMIN2_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

async function main() {
  const provider = new ethers.JsonRpcProvider(INFURA_URL);

  const artifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8")
  );
  const abi = artifact.abi;

  console.log("=== 测试 2/3 多签机制 (使用 Admin1 + Admin2) ===\n");

  // 使用 Admin1 创建操作
  console.log("1. Admin1 创建添加域名的操作...");
  const wallet1 = new ethers.Wallet(ADMIN1_KEY, provider);
  const contract1 = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet1);

  const testDomain = "multisig2.test.com";
  const tx1 = await contract1.createPendingOperation(testDomain, true);
  const receipt1 = await tx1.wait();
  console.log("   交易哈希:", receipt1.hash.substring(0, 20) + "...");

  const opId = await contract1.operationCount() - 1n;
  console.log("   操作ID:", opId);

  // Admin1 签名 (1/2)
  console.log("\n2. Admin1 签名 (1/2)...");
  const tx2 = await contract1.signOperation(opId);
  await tx2.wait();
  console.log("   签名完成");

  // Admin2 签名 (2/2)
  console.log("\n3. Admin2 签名 (2/2)...");
  const wallet2 = new ethers.Wallet(ADMIN2_KEY, provider);
  const contract2 = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet2);
  const tx3 = await contract2.signOperation(opId);
  await tx3.wait();
  console.log("   签名完成");

  // 执行 (2人签名，应该成功)
  console.log("\n4. 执行操作 (2人签名 - 应该成功)...");
  try {
    const tx4 = await contract2.executeOperation(opId);
    const receipt4 = await tx4.wait();
    console.log("   ✅ 执行成功! 交易:", receipt4.hash.substring(0, 20) + "...");
  } catch (e) {
    console.log("   ❌ 执行失败:", e.reason || e.message);
  }

  // 验证域名
  console.log("\n5. 验证域名是否在白名单中...");
  const isWhitelisted = await contract2.isDomainWhitelisted(testDomain);
  console.log("   域名", testDomain + ":", isWhitelisted ? "✅ 已添加" : "❌ 未添加");

  console.log("\n=== 2/3 多签机制测试完成 ===");
}

main().catch(console.error);