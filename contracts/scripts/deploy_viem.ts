import { network } from "hardhat";
import fs from "fs";

const ADMIN_ADDRESSES = [
  "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3",
  "0x1b7a22C21745ab854c0B55528B085718864d8f11",
  "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7",
];

async function main() {
  const { viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();

  console.log("部署者:", deployer.account.address);

  const artifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8")
  );

  console.log("部署 TLSNContentVerifierWithMultisig...");
  console.log("管理员:", ADMIN_ADDRESSES);

  const contract = await viem.deployContract("TLSNContentVerifierWithMultisig", [ADMIN_ADDRESSES], {
    client: { wallet: deployer },
  });

  console.log("部署交易:", contract.simulate);

  const receipt = await viem.getTransactionReceipt({ hash: contract.simulate.writeContract[0].hash });
  console.log("交易收据:", receipt);

  console.log("\n✅ 合约部署成功!");
  console.log("合约地址:", contract.address);

  // 验证
  const threshold = await contract.read.SIGNATURE_THRESHOLD();
  const notary = await contract.read.NOTARY_PUBLIC_KEY();

  console.log("\n验证结果:");
  console.log("- SIGNATURE_THRESHOLD:", threshold);
  console.log("- NOTARY_PUBLIC_KEY:", notary);

  console.log("\n更新 .env:");
  console.log(`CONTRACT_ADDRESS=${contract.address}`);
}

main().catch(console.error);