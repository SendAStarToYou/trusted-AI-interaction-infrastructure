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
  console.log("Deployer:", wallet.address);

  const contract = new ethers.Contract(contractAddress, artifact.abi, wallet);

  // 检查域名白名单状态
  const domains = ["dashscope.aliyuncs.com", "httpbin.org", "api.github.com"];

  for (const domain of domains) {
    const domainHash = ethers.keccak256(ethers.toUtf8Bytes(domain));
    const isWhitelisted = await contract.whitelistedDomains(domainHash);
    console.log(`\nDomain: ${domain}`);
    console.log(`  Hash: ${domainHash}`);
    console.log(`  Whitelisted: ${isWhitelisted}`);

    if (!isWhitelisted) {
      console.log(`  Adding to whitelist...`);
      try {
        const tx = await contract.createPendingOperation(domain, true);
        console.log(`  Tx sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`  Tx confirmed in block ${receipt.blockNumber}`);

        // 获取操作ID
        const opCount = await contract.operationCount();
        const opId = Number(opCount) - 1;
        console.log(`  Operation ID: ${opId}`);

        // 签名操作（需要至少0个签名，因为SIGNATURE_THRESHOLD=0）
        console.log(`  Signing operation...`);
        const tx2 = await contract.signOperation(opId);
        console.log(`  Sign tx: ${tx2.hash}`);
        await tx2.wait();

        // 执行操作
        console.log(`  Executing operation...`);
        const tx3 = await contract.executeOperation(opId);
        console.log(`  Execute tx: ${tx3.hash}`);
        await tx3.wait();

        console.log(`  ✅ ${domain} added to whitelist!`);
      } catch (e) {
        console.error(`  ❌ Error: ${e.message}`);
      }
    }
  }

  // 验证所有域名
  console.log("\n📋 Final whitelist status:");
  for (const domain of domains) {
    const isWhitelisted = await contract.isDomainWhitelisted(domain);
    console.log(`  ${domain}: ${isWhitelisted ? '✅' : '❌'}`);
  }
}

main().catch(console.error);
