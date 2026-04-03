import "dotenv/config";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import fs from "fs";

async function main() {
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
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

  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8"));
  const contractAddress = process.env.CONTRACT_ADDRESS;

  console.log("Contract:", contractAddress);

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

  // 添加域名白名单
  const testDomain = "dashscope.aliyuncs.com";
  console.log("Adding whitelist for:", testDomain);

  try {
    const tx = await contract.write.createPendingOperation([testDomain, true]);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log("✅ Whitelist operation created");
  } catch (e) {
    console.log("Error or already exists:", e.message);
  }
}

main().catch(console.error);