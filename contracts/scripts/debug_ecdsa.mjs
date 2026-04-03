import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";

const INFURA_URL = process.env.INFURA_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const NOTARY_KEY = process.env.NOTARY_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║              ECDSA 签名验证调试                            ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  const provider = new ethers.JsonRpcProvider(INFURA_URL);

  // 加载ABI
  const artifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8")
  );
  const abi = artifact.abi;

  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

  // 1. 检查 NOTARY_PRIVATE_KEY 对应的地址
  console.log("1. 检查 Notary 私钥:");
  console.log("   NOTARY_PRIVATE_KEY:", NOTARY_KEY ? NOTARY_KEY.slice(0,20) + "..." : "未设置");

  if (NOTARY_KEY) {
    const notaryWallet = new ethers.Wallet(NOTARY_KEY, provider);
    console.log("   私钥对应地址:", notaryWallet.address);

    // 2. 检查合约中的 NOTARY_PUBLIC_KEY
    const contractNotaryKey = await contract.NOTARY_PUBLIC_KEY();
    console.log("\n2. 合约中的 NOTARY_PUBLIC_KEY:");
    console.log("   地址:", contractNotaryKey);

    // 3. 比较两个地址
    console.log("\n3. 地址比较:");
    console.log("   匹配:", notaryWallet.address.toLowerCase() === contractNotaryKey.toLowerCase() ? "✅ 是" : "❌ 否");

    // 4. 检查 authorizedSigners 白名单
    console.log("\n4. 检查 authorizedSigners 白名单:");
    const isAuthorized = await contract.authorizedSigners(notaryWallet.address);
    console.log("   Notary 地址已授权:", isAuthorized ? "✅ 是" : "❌ 否");
  }

  // 5. 检查 SIGNATURE_THRESHOLD
  console.log("\n5. 多签配置:");
  const threshold = await contract.SIGNATURE_THRESHOLD();
  console.log("   SIGNATURE_THRESHOLD:", Number(threshold));

  // 6. 检查域名白名单
  console.log("\n6. 域名白名单:");
  const domain = "dashscope.aliyuncs.com";
  const isWhitelisted = await contract.isDomainWhitelisted(domain);
  console.log("   dashscope.aliyuncs.com:", isWhitelisted ? "✅ 已添加" : "❌ 未添加");

  // 7. 列出所有管理员
  console.log("\n7. 管理员列表:");
  const admins = [
    "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3",
    "0x1b7a22C21745ab854c0B55528B085718864d8f11",
    "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7"
  ];
  for (const admin of admins) {
    const isAdmin = await contract.admins(admin);
    console.log("   ", admin, isAdmin ? "✅" : "❌");
  }

  console.log("\n╔═══════════════════════════════════════════════════════════╗");
  console.log("║                      调试完成                              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
}

main().catch(console.error);