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

  // 添加域名白名单
  const testDomain = "dashscope.aliyuncs.com";
  console.log("Adding whitelist for:", testDomain);

  try {
    const tx = await contract.createPendingOperation(testDomain, true);
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Whitelist operation created, tx:", tx.hash);
  } catch (e) {
    console.log("Error:", e.message);
  }
}

main().catch(console.error);