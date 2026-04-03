import { ethers } from "ethers";
import "dotenv/config";

const NOTARY_KEY = process.env.NOTARY_PRIVATE_KEY;
const wallet = new ethers.Wallet(NOTARY_KEY);

console.log("Notary address:", wallet.address);
console.log("Expected:", "0x1633542114D389a9b370c1c277e172a793f5c789");
console.log("Match:", wallet.address.toLowerCase() === "0x1633542114d389a9b370c1c277e172a793f5c789".toLowerCase());