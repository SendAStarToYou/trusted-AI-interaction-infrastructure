import "dotenv/config";

async function main() {
  console.log("Setup: Creating whitelist operation...");

  // 使用 ethers v6
  const { ethers } = await import("ethers");

  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey?.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  const contractAddress = process.env.CONTRACT_ADDRESS || "0xe78a628224dcd77fbc46b42971b4050a47137fd0";

  const fs = await import("fs");
  const artifact = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json",
      "utf8"
    )
  );

  const contract = new ethers.Contract(contractAddress, artifact.abi, wallet);

  console.log("Creating whitelist operation for: dashscope.aliyuncs.com");

  const tx = await contract.createPendingOperation("dashscope.aliyuncs.com", true);
  await tx.wait();

  console.log("✅ Created whitelist operation");
  console.log("   Transaction:", tx.hash);

  console.log("\n📋 Next steps:");
  console.log("1. Sign operation with other admin accounts");
  console.log("2. Execute the operation");
  console.log("3. Then submit content to chain");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });