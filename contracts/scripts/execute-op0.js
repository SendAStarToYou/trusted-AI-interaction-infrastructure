import "dotenv/config";

async function main() {
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

  // 操作 0
  const operationId = 0;
  const wallet = new ethers.Wallet(deployerKey, provider);
  const contractWithSigner = contract.connect(wallet);

  // 检查操作状态
  const op = await contract.getOperationDetails(operationId);
  console.log("Operation 0:", {
    domain: op.domain,
    signatures: op.signatureCount,
    executed: op.executed,
  });

  if (!op.executed) {
    // 签名
    const tx1 = await contractWithSigner.signOperation(operationId);
    await tx1.wait();
    console.log("✅ Sign:", tx1.hash);

    // 执行
    const tx2 = await contractWithSigner.executeOperation(operationId);
    await tx2.wait();
    console.log("✅ Execute:", tx2.hash);
  }

  // 验证
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes("dashscope.aliyuncs.com"));
  const isWhitelisted = await contract.whitelistedDomains(domainHash);
  console.log("\nDomain whitelisted:", isWhitelisted);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });