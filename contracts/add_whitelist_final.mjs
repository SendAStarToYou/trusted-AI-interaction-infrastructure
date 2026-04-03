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
    console.log("Adding whitelist...");
    const tx = await contract.createPendingOperation("dashscope.aliyuncs.com", true);
    console.log("Operation created:", tx.hash);
    await tx.wait();

    // 签名并执行（使用同一个钱包，因为三个admin是同一个地址）
    const tx2 = await contract.signOperation(0);
    console.log("Signed:", tx2.hash);
    await tx2.wait();

    const tx3 = await contract.executeOperation(0);
    console.log("Executed:", tx3.hash);
    await tx3.wait();

    console.log("✅ Whitelist added!");
  } else {
    console.log("Domain already whitelisted");
  }
}

main().catch(console.error);