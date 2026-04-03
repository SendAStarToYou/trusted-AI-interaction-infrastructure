import { ethers } from "ethers";
import fs from "fs";

// 加载 ABI
const abi = JSON.parse(fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf8")).abi;

// 连接到 Sepolia
const provider = ethers.getDefaultProvider("sepolia");
const contractAddress = "0x8dEBF3C67d6712f8c77A6CE50113148Ae81C035B";
const contract = new ethers.Contract(contractAddress, abi, provider);

// 从命令行参数获取 proof
const proofHex = process.argv[2];
if (!proofHex) {
    console.log("Usage: node validate_proof.mjs <proof_hex>");
    process.exit(1);
}

const proof = proofHex.startsWith("0x") ? proofHex.slice(2) : proofHex;
const proofBytes = Buffer.from(proof, "hex");

console.log("Proof length:", proofBytes.length);
console.log("Proof (first 64 bytes):", proofHex.slice(0, 128));

// 调用验证函数
async function validate() {
    try {
        // 直接调用合约的验证函数
        const result = await contract.validateTLSNProofSimple("0x" + proof);
        console.log("Validation result:", result);
    } catch (e) {
        console.log("Error:", e.message);
    }
}

validate();