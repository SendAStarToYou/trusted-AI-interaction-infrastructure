import { ethers } from "ethers";
import "dotenv/config";

// 测试密钥 (全1)
const TEST_KEY = "0x" + "01".repeat(32);
console.log("测试密钥:", TEST_KEY);

const wallet = new ethers.Wallet(TEST_KEY);
console.log("密钥对应地址:", wallet.address);
console.log("合约期望地址:", "0x1633542114D389a9b370c1c277e172a793f5c789");
console.log("匹配:", wallet.address.toLowerCase() === "0x1633542114d389a9b370c1c277e172a793f5c789".toLowerCase());