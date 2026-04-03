import "dotenv/config";

async function main() {
  console.log("Adding domain to whitelist...");

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

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(contractAddress, artifact.abi, provider);
  const contractWithSigner = contract.connect(wallet);

  const testDomain = "dashscope.aliyuncs.com";

  console.log("Creating whitelist operation for:", testDomain);

  try {
    const tx = await contractWithSigner.createPendingOperation(testDomain, true);
    await tx.wait();
    console.log("✅ Operation created! Transaction:", tx.hash);
  } catch (e) {
    console.log("Error:", e.message.slice(0, 200));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });