import "dotenv/config";
import { ethers } from "ethers";

async function main() {
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

  // 检查操作 0
  console.log("=== Operation 0 ===");
  try {
    const op0 = await contract.getOperationDetails(0);
    console.log("  domain:", op0.domain);
    console.log("  executed:", op0.executed);
    console.log("  signatures:", op0.signatureCount);
  } catch (e) {
    console.log("  Error:", e.message.slice(0, 50));
  }

  // 检查操作 1
  console.log("\n=== Operation 1 ===");
  const op = await contract.getOperationDetails(1);
  console.log("  domain:", op.domain);
  console.log("  opType:", op.opType);
  console.log("  signatures:", op.signatureCount);
  console.log("  executed:", op.executed);

  // 检查操作 2
  console.log("\n=== Operation 2 ===");
  try {
    const op2 = await contract.getOperationDetails(2);
    console.log("  domain:", op2.domain);
    console.log("  executed:", op2.executed);
  } catch (e) {
    console.log("  No operation 2");
  }

  // 计算域名哈希
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes("dashscope.aliyuncs.com"));
  console.log("\nDomain hash:", domainHash);

  // 检查白名单状态
  const isWhitelisted = await contract.whitelistedDomains(domainHash);
  console.log("Whitelisted:", isWhitelisted);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });