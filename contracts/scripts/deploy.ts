import "dotenv/config";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// 加载 .env 文件
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

const INFURA_URL = process.env.INFURA_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

const ADMIN_ADDRESSES = [
  "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3",
  "0x1b7a22C21745ab854c0B55528B085718864d8f11",
  "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7",
];

const provider = new ethers.JsonRpcProvider(INFURA_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// 加载合约字节码和ABI
const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8"));

async function main() {
  console.log("部署 TLSNContentVerifierWithMultisig 合约...");
  console.log("管理员:", ADMIN_ADDRESSES);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // 部署合约
  const contract = await factory.deploy(ADMIN_ADDRESSES);
  console.log("部署交易已发送:", contract.deploymentTransaction().hash);

  // 等待部署完成
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("\n✅ 合约部署成功!");
  console.log("合约地址:", address);

  // 验证部署
  console.log("\n验证部署结果:");
  console.log("- SIGNATURE_THRESHOLD:", await contract.SIGNATURE_THRESHOLD());
  console.log("- NOTARY_PUBLIC_KEY:", await contract.NOTARY_PUBLIC_KEY());

  console.log("\n新合约地址需要更新到 .env:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch(console.error);