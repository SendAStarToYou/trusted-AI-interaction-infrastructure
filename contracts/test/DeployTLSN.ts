import { network } from "hardhat";
import assert from "node:assert/strict";
import fs from "fs";

describe("Deploy TLSNContract", async function () {
  const { viem } = await network.connect();
  const [deployer] = await viem.getWalletClients();

  const ADMIN_ADDRESSES = [
    "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3",
    "0x1b7a22C21745ab854c0B55528B085718864d8f11",
    "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7",
  ];

  it("Should deploy new contract", async function () {
    const artifact = JSON.parse(
      fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8")
    );

    console.log("部署合约...");
    console.log("部署者:", deployer.account.address);

    const contract = await viem.deployContract("TLSNContentVerifierWithMultisig", [ADMIN_ADDRESSES], {
      client: { wallet: deployer },
    });

    console.log("合约地址:", contract.address);

    // 验证部署
    const threshold = await contract.read.SIGNATURE_THRESHOLD();
    const notary = await contract.read.NOTARY_PUBLIC_KEY();

    console.log("SIGNATURE_THRESHOLD:", threshold);
    console.log("NOTARY_PUBLIC_KEY:", notary);

    assert.equal(threshold, 2n, "Threshold should be 2");
    assert.equal(
      notary.toLowerCase(),
      "0x1633542114d389a9b370c1c277e172a793f5c789".toLowerCase(),
      "Notary address mismatch"
    );

    console.log("\n✅ 部署成功!");
    console.log("请更新 .env 中的 CONTRACT_ADDRESS 为:", contract.address);
  });
});