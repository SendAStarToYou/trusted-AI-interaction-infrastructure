import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);

  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8"));
  const contractAddress = process.env.CONTRACT_ADDRESS;
  console.log("Contract:", contractAddress);

  const contract = new ethers.Contract(contractAddress, artifact.abi, provider);

  // 获取 operationCount
  const opCount = await contract.operationCount();
  console.log("Current operation count:", opCount);

  // 使用三个管理员私钥签名
  const adminKeys = [
    process.env.ADMIN1_PRIVATE_KEY,
    process.env.ADMIN2_PRIVATE_KEY,
    process.env.ADMIN3_PRIVATE_KEY
  ];

  // 最后一个是部署者，已经创建了操作 0
  // 现在需要用另外两个密钥签名

  // 找到新创建的操作 ID
  const newOpId = opCount; // 刚创建的操作

  for (let i = 1; i < adminKeys.length; i++) {
    const wallet = new ethers.Wallet(adminKeys[i], provider);
    const contractWithSigner = contract.connect(wallet);

    try {
      console.log(`Signing with admin ${i+1}...`);
      const tx = await contractWithSigner.signOperation(newOpId);
      console.log(`  Signed: ${tx.hash}`);
      await tx.wait();
    } catch (e) {
      console.log(`  Error or already signed: ${e.message}`);
    }
  }

  // 执行操作
  const executor = new ethers.Wallet(adminKeys[0], provider);
  const contractExecutor = contract.connect(executor);

  try {
    console.log("Executing operation...");
    const tx = await contractExecutor.executeOperation(newOpId);
    console.log(`  Executing: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Operation executed!");
  } catch (e) {
    console.log(`  Execute error: ${e.message}`);
  }

  // 验证白名单
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes("dashscope.aliyuncs.com"));
  const isWhitelisted = await contract.whitelistedDomains(domainHash);
  console.log("Domain whitelisted:", isWhitelisted);
}

main().catch(console.error);