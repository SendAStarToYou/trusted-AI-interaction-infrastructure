import { ethers } from "ethers";
import fs from "fs";

// Read proof from file - convert to Uint8Array
let proofHex = fs.readFileSync("./scripts/proof_hex.txt", "utf8").trim();
if (proofHex.startsWith("0x")) proofHex = proofHex.slice(2);
const proofBytes = Buffer.from(proofHex, "hex");
console.log("Proof length:", proofBytes.length);

// Convert to ethers Bytes-like format
const proofArray = Array.from(proofBytes);
console.log("First 4 bytes:", proofArray.slice(0, 4));
console.log("Bytes at 32-36:", proofArray.slice(32, 36));

const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/d27bed19d2d04e0daa3adf3c9d2809c9");

const abi = [
    "function validateTLSNProofSimple(bytes memory _proof) external view returns (bool, string memory)",
    "function validateTLSNProofECDSA(bytes memory _proof) external view returns (bool, string memory)"
];

const contract = new ethers.Contract("0x8dEBF3C67d6712f8c77A6CE50113148Ae81C035B", abi, provider);

async function test() {
    // Try with hex string
    let proofHexWithPrefix = "0x" + proofHex;
    try {
        console.log("\n=== Testing with hex string ===");
        const result1 = await contract.validateTLSNProofSimple(proofHexWithPrefix);
        console.log("Result:", result1);
    } catch(e) {
        console.log("Error:", e.message);
    }

    // Try with Uint8Array
    try {
        console.log("\n=== Testing with Uint8Array ===");
        const result2 = await contract.validateTLSNProofSimple(proofBytes);
        console.log("Result:", result2);
    } catch(e) {
        console.log("Error:", e.message);
    }
}

test();