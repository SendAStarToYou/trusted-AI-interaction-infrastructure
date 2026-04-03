import "dotenv/config";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

async function main() {
  console.log("Deploying TLSNContentVerifierWithMultisig...");

  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey?.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }

  const account = privateKeyToAccount(privateKey);

  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.INFURA_URL),
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.INFURA_URL),
  });

  console.log("Deployer:", account.address);

  const admin1 = "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3";
  const admin2 = "0x1b7a22C21745ab854c0B55528B085718864d8f11";
  const admin3 = "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7";

  console.log("Admin addresses:", admin1, admin2, admin3);

  const fs = await import("fs");
  const artifact = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json",
      "utf8"
    )
  );

  console.log("\n📤 Deploying contract...");

  const tx = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [[admin1, admin2, admin3]],
  });

  console.log("Transaction sent:", tx);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

  const contractAddress = receipt.contractAddress;

  console.log("\n✅ Contract deployed to:", contractAddress);
  console.log("\n📝 Add this to your .env file:");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);

  fs.writeFileSync(
    "./deployment-address.txt",
    `Contract deployed to: ${contractAddress}\n`
  );

  console.log("\n🔧 Initial setup...");

  const contract = {
    address: contractAddress,
    abi: artifact.abi,
    write: async (functionName, args) => {
      const { request } = await wallet.simulateContract({
        address: contractAddress,
        abi: artifact.abi,
        functionName,
        args,
      });
      return wallet.writeContract(request);
    },
  };

  const testDomain = "dashscope.aliyuncs.com";
  const tx2 = await contract.write.createPendingOperation([testDomain, true]);

  await publicClient.waitForTransactionReceipt({ hash: tx2 });

  console.log("✅ Created whitelist operation for:", testDomain);
  console.log("   Operation ID: 0");

  console.log("\n📋 Next steps:");
  console.log("1. Sign the operation with 2 more admin accounts");
  console.log("2. Execute the operation");
  console.log("3. Then you can submit content to chain");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });