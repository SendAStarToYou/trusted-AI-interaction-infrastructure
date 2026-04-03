import "dotenv/config";
import { ethers } from "ethers";

async function main() {
  const privateKey = process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : "0x" + process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey);
  console.log("PRIVATE_KEY address:", wallet.address);

  const admin1 = process.env.ADMIN1_PRIVATE_KEY.startsWith("0x") ? process.env.ADMIN1_PRIVATE_KEY : "0x" + process.env.ADMIN1_PRIVATE_KEY;
  const w1 = new ethers.Wallet(admin1);
  console.log("ADMIN1 address:", w1.address);

  const admin2 = process.env.ADMIN2_PRIVATE_KEY.startsWith("0x") ? process.env.ADMIN2_PRIVATE_KEY : "0x" + process.env.ADMIN2_PRIVATE_KEY;
  const w2 = new ethers.Wallet(admin2);
  console.log("ADMIN2 address:", w2.address);

  const admin3 = process.env.ADMIN3_PRIVATE_KEY.startsWith("0x") ? process.env.ADMIN3_PRIVATE_KEY : "0x" + process.env.ADMIN3_PRIVATE_KEY;
  const w3 = new ethers.Wallet(admin3);
  console.log("ADMIN3 address:", w3.address);
}

main().catch(console.error);