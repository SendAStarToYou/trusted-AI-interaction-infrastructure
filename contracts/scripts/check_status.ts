import "dotenv/config";
import { configVariable } from "hardhat/config";
import { ethers } from "ethers";

const INFURA_URL = configVariable("INFURA_URL");
const PRIVATE_KEY = configVariable("PRIVATE_KEY");

const provider = new ethers.JsonRpcProvider(INFURA_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const contractAddress = "0x7deb20974ec0d383458421425aa060ddd1f1dd5e";

// 简单的合约ABI
const abi = [
  "function SIGNATURE_THRESHOLD() view returns (uint8)",
  "function operationCount() view returns (uint256)",
  "function NOTARY_PUBLIC_KEY() view returns (address)",
  "function pendingOperations(uint256) view returns (string domain, uint8 opType, uint8 signatureCount, bool executed)",
];

const contract = new ethers.Contract(contractAddress, abi, wallet);

async function main() {
  const threshold = await contract.SIGNATURE_THRESHOLD();
  const count = await contract.operationCount();
  const notary = await contract.NOTARY_PUBLIC_KEY();

  console.log("SIGNATURE_THRESHOLD:", threshold.toString());
  console.log("operationCount:", count.toString());
  console.log("NOTARY_PUBLIC_KEY:", notary);

  // Check pending operations
  if (count > 0) {
    for (let i = 0; i < Number(count); i++) {
      try {
        const op = await contract.pendingOperations(i);
        console.log(`\nOperation ${i}:`, {
          domain: op.domain,
          opType: op.opType,
          signatureCount: op.signatureCount,
          executed: op.executed,
        });
      } catch (e) {
        break;
      }
    }
  }
}

main().catch(console.error);