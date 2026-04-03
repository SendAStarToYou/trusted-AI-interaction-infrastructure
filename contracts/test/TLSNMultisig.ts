import { network } from "hardhat";
import assert from "node:assert/strict";

describe("TLSNContentVerifier Multisig", async function () {
  const { viem } = await network.connect();

  const CONTRACT_ADDRESS = "0x7deb20974ec0d383458421425aa060ddd1f1dd5e";

  it("Should have SIGNATURE_THRESHOLD = 2", async function () {
    const contract = await viem.getContractAt(
      "TLSNContentVerifierWithMultisig",
      CONTRACT_ADDRESS
    );

    const threshold = await contract.read.SIGNATURE_THRESHOLD();
    console.log("SIGNATURE_THRESHOLD:", threshold);

    assert.equal(threshold, 2n, "Threshold should be 2");
  });

  it("Should have NOTARY_PUBLIC_KEY set", async function () {
    const contract = await viem.getContractAt(
      "TLSNContentVerifierWithMultisig",
      CONTRACT_ADDRESS
    );

    const notary = await contract.read.NOTARY_PUBLIC_KEY();
    console.log("NOTARY_PUBLIC_KEY:", notary);

    assert.notEqual(notary, "0x0000000000000000000000000000000000000000");
  });

  it("Should check operationCount", async function () {
    const contract = await viem.getContractAt(
      "TLSNContentVerifierWithMultisig",
      CONTRACT_ADDRESS
    );

    const count = await contract.read.operationCount();
    console.log("operationCount:", count);
  });
});