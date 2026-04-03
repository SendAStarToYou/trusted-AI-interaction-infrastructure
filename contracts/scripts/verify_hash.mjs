import { ethers } from "ethers";

// 计算 Solidity 中的 keccak256 哈希
const hashV1 = ethers.keccak256(ethers.toUtf8Bytes("TLSN_PROOF_V1"));
const hashV0 = ethers.keccak256(ethers.toUtf8Bytes("TLSN_PROOF"));

console.log("keccak256('TLSN_PROOF_V1'):", hashV1);
console.log("keccak256('TLSN_PROOF'):", hashV0);

// 当前代码中的哈希
const codeHash = "0x060bf4087553b05a79c27efa1d205885fe88037ded0bdf89ed2a74fb1ace8ad0";
console.log("\n当前代码中的哈希:", codeHash);
console.log("匹配 V1:", hashV1 === codeHash);
console.log("匹配 V0:", hashV0 === codeHash);