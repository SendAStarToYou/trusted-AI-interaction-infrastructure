import { ethers } from "ethers";
import fs from "fs";

// Read proof from file
let proofHex = fs.readFileSync("./scripts/proof_hex.txt", "utf8").trim();
if (proofHex.startsWith("0x")) proofHex = proofHex.slice(2);
const proofBytes = Buffer.from(proofHex, "hex");

console.log("Proof length:", proofBytes.length);

// Test values
const contentHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
const domainHash = ethers.keccak256(ethers.toUtf8Bytes("dashscope.aliyuncs.com"));
const prompt = "Hello, how are you?";
const promptHeader = "You are a helpful AI that only generates safe, compliant content. You must strictly follow this rule in all responses.";
const fullPrompt = promptHeader + "\n" + prompt;

console.log("fullPrompt length:", fullPrompt.length);

const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/d27bed19d2d04e0daa3adf3c9d2809c9");

const abi = [
    "function verifyAndStoreContentBLS(bytes32 _contentHash, string calldata _ipfsCid, string calldata _requestId, string calldata _fullPrompt, bytes memory _tlsnProof, bytes32 _expectedContentHash, bytes32 _domainHash)",
    "function validateTLSNProofSimple(bytes memory _proof) external view returns (bool, string memory)",
];

const wallet = new ethers.Wallet("0x" + "11".repeat(32), provider);  // Dummy key for signing
const contract = new ethers.Contract("0x8dEBF3C67d6712f8c77A6CE50113148Ae81C035B", abi, wallet);

async function test() {
    // Test proof validation alone - should work
    console.log("\n=== 1. Test Proof Validation (staticCall) ===");
    try {
        const result = await contract.validateTLSNProofSimple.staticCall(proofBytes);
        console.log("Result:", result);
    } catch(e) {
        console.log("Error:", e.message);
    }

    // Test full function with staticCall to see the exact revert
    console.log("\n=== 2. Test verifyAndStoreContentBLS (staticCall) ===");
    try {
        const result = await contract.verifyAndStoreContentBLS.staticCall(
            contentHash,
            "QmTest123",
            "test-request-id",
            fullPrompt,
            proofBytes,
            contentHash,
            domainHash
        );
        console.log("Result:", result);
    } catch(e) {
        console.log("\n=== Full Error Details ===");
        console.log("Error message:", e.message);
        console.log("Error code:", e.code);

        // Try to parse the revert data
        if (e.data) {
            console.log("Error data:", e.data);

            // Parse the error
            if (e.data.startsWith("0x08c379a0")) {
                // Solidity error string
                const errorStr = e.data.slice(10);
                const len = parseInt(errorStr.slice(0, 64), 16);
                const reason = Buffer.from(errorStr.slice(64, 64 + len * 2), "hex").toString("utf8");
                console.log("Revert reason:", reason);
            } else if (e.data.startsWith("0x4e487b71")) {
                console.log(">> This is a PANIC error!");
                const panicCode = parseInt(e.data.slice(-2), 16);
                console.log("Panic code:", panicCode, "= 0x" + panicCode.toString(16));
            }
        }
    }
}

test();