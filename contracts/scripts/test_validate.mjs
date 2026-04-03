import { ethers } from "ethers";
import fs from "fs";

// Read the current proof
let proofHex = fs.readFileSync("./scripts/proof_hex.txt", "utf8").trim();
if (proofHex.startsWith("0x")) proofHex = proofHex.slice(2);
const proofBytes = Buffer.from(proofHex, "hex");

console.log("Proof length:", proofBytes.length);

const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/d27bed19d2d04e0daa3adf3c9d2809c9");

const abi = [
    "function validateTLSNProofSimple(bytes memory _proof) external view returns (bool, string memory)",
    "function validateTLSNProofECDSA(bytes memory _proof) external view returns (bool, string memory)",
    "function validateTLSNProofBLS(bytes memory _proof) external returns (bool, string memory)"
];

const contract = new ethers.Contract("0x8dEBF3C67d6712f8c77A6CE50113148Ae81C035B", abi, provider);

async function test() {
    console.log("\n=== Testing validateTLSNProofSimple ===");
    try {
        const result1 = await contract.validateTLSNProofSimple(proofBytes);
        console.log("Result:", result1);
    } catch(e) {
        console.log("Error:", e.message.slice(0, 150));
    }

    console.log("\n=== Testing validateTLSNProofECDSA ===");
    try {
        const result2 = await contract.validateTLSNProofECDSA(proofBytes);
        console.log("Result:", result2);
    } catch(e) {
        console.log("Error:", e.message.slice(0, 150));
    }

    console.log("\n=== Testing validateTLSNProofBLS ===");
    try {
        const result3 = await contract.validateTLSNProofBLS(proofBytes);
        console.log("Result:", result3);
    } catch(e) {
        console.log("Error:", e.message.slice(0, 150));
    }
}

test();