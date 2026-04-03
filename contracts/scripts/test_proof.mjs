import { ethers } from "hardhat";
import { ethers as ethersLib } from "ethers";

// Get the proof from command line
const proofHex = process.argv[2];
if (!proofHex) {
    console.log("Usage: npx hardhat run scripts/test_proof.mjs <proof_hex>");
    process.exit(1);
}

async function main() {
    // Get contract
    const contractAddress = "0x8dEBF3C67d6712f8c77A6CE50113148Ae81C035B";
    const abi = [
        "function validateTLSNProofSimple(bytes memory _proof) external view returns (bool, string memory)",
        "function validateTLSNProofECDSA(bytes memory _proof) external view returns (bool, string memory)"
    ];

    // Connect to Sepolia
    const provider = ethersLib.getDefaultProvider("sepolia");

    // Use a temporary wallet (just for reading)
    const wallet = new ethersLib.Wallet("0x" + "00".repeat(32), provider);
    const contract = new ethersLib.Contract(contractAddress, abi, wallet);

    console.log("Testing proof with length:", proofHex.length / 2, "bytes");

    // Try simple validation
    try {
        const [valid, reason] = await contract.validateTLSNProofSimple(proofHex);
        console.log("validateTLSNProofSimple result:", { valid, reason });
    } catch (e) {
        console.log("validateTLSNProofSimple error:", e.message);
    }

    // Try ECDSA validation
    try {
        const [valid, reason] = await contract.validateTLSNProofECDSA(proofHex);
        console.log("validateTLSNProofECDSA result:", { valid, reason });
    } catch (e) {
        console.log("validateTLSNProofECDSA error:", e.message);
    }
}

main();