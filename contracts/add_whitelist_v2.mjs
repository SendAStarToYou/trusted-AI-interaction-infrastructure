import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";

async function main() {
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8"));
  const contractAddress = process.env.CONTRACT_ADDRESS;

  console.log("Contract:", contractAddress);

  const contract = new ethers.Contract(contractAddress, artifact.abi, wallet);

  // 检查白名单
  const domainHash = ethers.keccak256(ethers.toUtf8Bytes("dashscope.aliyuncs.com"));
  const isWhitelisted = await contract.whitelistedDomains(domainHash);
  console.log("Domain whitelisted:", isWhitelisted);

  if (!isWhitelisted) {
    console.log("Creating new operation...");
    const tx1 = await contract.createPendingOperation("dashscope.aliyuncs.com", true);
    console.log("Created:", tx1.hash);
    await tx1.wait();

    // 获取新的操作 ID
    const opCount = await contract.operationCount();
    console.log("Operation count:", opCount);

    const opId = opCount - 1n;
    console.log("Executing operation", opId, "...");

    const tx2 = await contract.executeOperation(opId);
    console.log("Executed:", tx2.hash);
    await tx2.wait();
    console.log("✅ Whitelist added!");
  } else {
    console.log("Domain already whitelisted");
  }
}

main().catch(console.error);