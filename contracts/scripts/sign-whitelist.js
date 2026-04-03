import "dotenv/config";

async function main() {
  console.log("Signing and executing whitelist operation...");

  const { ethers } = await import("ethers");

  const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);
  const contractAddress = process.env.CONTRACT_ADDRESS;

  const fs = await import("fs");
  const artifact = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json",
      "utf8"
    )
  );

  const contract = new ethers.Contract(contractAddress, artifact.abi, provider);

  // 操作 ID 0 (第一个操作)
  const operationId = 0;

  // 使用 3 个不同的管理员密钥签名
  const adminKeys = [
    process.env.PRIVATE_KEY,
    process.env.ADMIN1_PRIVATE_KEY || process.env.PRIVATE_KEY,
    process.env.ADMIN2_PRIVATE_KEY || process.env.PRIVATE_KEY,
  ];

  // 第一轮签名
  console.log("Round 1 signatures:");
  for (let i = 0; i < 2; i++) {
    const wallet = new ethers.Wallet(adminKeys[i], provider);
    const contractWithSigner = contract.connect(wallet);
    try {
      const tx = await contractWithSigner.signOperation(operationId);
      await tx.wait();
      console.log(`  ✅ Admin ${i + 1} signed: ${tx.hash.slice(0, 10)}...`);
    } catch (e) {
      console.log(`  ❌ Admin ${i + 1} error:`, e.message.slice(0, 80));
    }
  }

  // 执行操作
  console.log("\nExecuting operation...");
  const wallet = new ethers.Wallet(adminKeys[0], provider);
  const contractWithSigner = contract.connect(wallet);
  try {
    const tx = await contractWithSigner.executeOperation(operationId);
    await tx.wait();
    console.log("  ✅ Operation executed:", tx.hash.slice(0, 10) + "...");
  } catch (e) {
    console.log("  ❌ Execution error:", e.message.slice(0, 100));
  }

  // 验证域名是否白名单
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes("dashscope.aliyuncs.com"));
  const isWhitelisted = await contract.whitelistedDomains(domainHash);
  console.log("\nDomain dashscope.aliyuncs.com whitelisted:", isWhitelisted);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });