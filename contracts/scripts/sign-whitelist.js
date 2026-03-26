import "dotenv/config";

async function main() {
  console.log("Sign: Signing and executing whitelist operation...");

  const { ethers } = await import("ethers");

  const deployerKey = process.env.PRIVATE_KEY;

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

  // 操作 ID 1
  const operationId = 1;

  // 使用部署者签名（它是唯一的管理员）
  const wallet = new ethers.Wallet(deployerKey, provider);
  const contractWithSigner = contract.connect(wallet);

  try {
    const tx1 = await contractWithSigner.signOperation(operationId);
    await tx1.wait();
    console.log("✅ Sign 1:", tx1.hash);
  } catch (e) {
    console.log("Sign 1 error:", e.message.slice(0, 100));
  }

  try {
    const tx2 = await contractWithSigner.signOperation(operationId);
    await tx2.wait();
    console.log("✅ Sign 2:", tx2.hash);
  } catch (e) {
    console.log("Sign 2 error:", e.message.slice(0, 100));
  }

  // 执行操作
  console.log("\nExecuting operation...");
  try {
    const tx = await contractWithSigner.executeOperation(operationId);
    await tx.wait();
    console.log("✅ Operation executed:", tx.hash);
  } catch (e) {
    console.log("Execution error:", e.message.slice(0, 100));
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