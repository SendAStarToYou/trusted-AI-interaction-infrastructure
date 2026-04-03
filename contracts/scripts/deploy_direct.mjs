import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";

const INFURA_URL = process.env.INFURA_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const ADMIN_ADDRESSES = [
  "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3",
  "0x1b7a22C21745ab854c0B55528B085718864d8f11",
  "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7",
];

async function main() {
  if (!INFURA_URL || !PRIVATE_KEY) {
    throw new Error("Missing INFURA_URL or PRIVATE_KEY in .env");
  }

  console.log("INFURA_URL:", INFURA_URL ? "set" : "missing");
  console.log("PRIVATE_KEY:", PRIVATE_KEY ? "set" : "missing");

  // 创建一个不带任何封装的provider
  const provider = new ethers.JsonRpcProvider(INFURA_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("部署者:", wallet.address);

  // 加载合约字节码和ABI
  const artifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8")
  );

  console.log("部署 TLSNContentVerifierWithMultisig...");
  console.log("管理员:", ADMIN_ADDRESSES);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // 部署合约
  console.log("发送部署交易...");
  const contract = await factory.deploy(ADMIN_ADDRESSES);

  console.log("交易哈希:", contract.deploymentTransaction().hash);

  // 等待部署完成
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("\n✅ 合约部署成功!");
  console.log("合约地址:", address);

  // 验证
  const threshold = await contract.SIGNATURE_THRESHOLD();
  const notary = await contract.NOTARY_PUBLIC_KEY();

  console.log("\n验证结果:");
  console.log("- SIGNATURE_THRESHOLD:", Number(threshold));
  console.log("- NOTARY_PUBLIC_KEY:", notary);

  console.log("\n更新 .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch(console.error);