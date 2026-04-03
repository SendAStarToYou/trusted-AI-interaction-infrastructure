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
    console.log("Executing operation 1...");
    try {
      const tx = await contract.executeOperation(1);
      console.log("Executed:", tx.hash);
      await tx.wait();
      console.log("✅ Whitelist added!");
    } catch (e) {
      console.log("Error:", e.message);
    }
  } else {
    console.log("Domain already whitelisted");
  }
}

main().catch(console.error);