// Local BLS verification script - using raw HTTP
// Run with: npx tsx scripts/verify-bls-local.ts <proof_hex>

import * as fs from "fs";
import { ethers } from "ethers";

// Load config
const envContent = fs.readFileSync("./.env", "utf-8");
const config = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    config[match[1].trim()] = match[2].trim();
  }
});

// BLS12-381 G2 generator point (from RFC 9387)
// x = 0x13e029b1174d23d89c27ec35a7a01565e0a005b3daf5006d13f655af8b45a85e3f897d42ee3af3ef0f8b30e0a03e03e03
// y = 0x0a3e2cf3aba6f93df518a0f64f2e7f4d6b2f5a8c4c8c7a6d9e7c7b8a1f0d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9
const G2_GENERATOR = {
  x: [
    BigInt("0x13e029b1174d23d89c27ec35a7a01565"),
    BigInt("0x0a005b3daf5006d13f655af8b45a85e")
  ],
  y: [
    BigInt("0x0a3e2cf3aba6f93df518a0f64f2e7f4"),
    BigInt("0xd6b2f5a8c4c8c7a6d9e7c7b8a1f0d2")
  ]
};

function parseProof(proof: Buffer) {
  return {
    proofType: proof.subarray(32, 64).toString("utf8").replace(/\0/g, ""),
    timestamp: proof.subarray(64, 96).readBigUInt64BE(0),
    appDataHash: proof.subarray(160, 192),
    handshakeHash: proof.subarray(228, 260),
    signature: proof.subarray(360, 408),
    pubkey: proof.subarray(408, 504)
  };
}

async function verifyBLSProof(messageHash: string, signature: Buffer, pubkey: Buffer) {
  console.log("\n=== BLS Verification ===");

  // Parse signature
  console.log("Signature:", signature.toString("hex"));
  const sigX = BigInt("0x" + signature.subarray(0, 32).toString("hex"));
  const sigY = BigInt("0x" + (signature.subarray(16, 48).toString("hex") || signature.subarray(32).toString("hex")));

  console.log("Sig X:", sigX.toString(16));
  console.log("Sig Y:", sigY.toString(16));

  // Parse pubkey - allocate 128 bytes to hold full G2 point (X0, X1, Y0, Y1)
  const paddedPubkey = Buffer.alloc(128);
  if (pubkey.length >= 32) {
    pubkey.copy(paddedPubkey);
  }

  const safeHex = (buf: Buffer, start: number, len: number): string => {
    if (start + len > buf.length) return "0";
    const hex = buf.subarray(start, start + len).toString("hex");
    return hex || "0";
  };

  const pubkeyX0 = BigInt("0x" + safeHex(paddedPubkey, 0, 32) || "0");
  const pubkeyX1 = BigInt("0x" + safeHex(paddedPubkey, 32, 32) || "0");
  const pubkeyY0 = BigInt("0x" + safeHex(paddedPubkey, 64, 32) || "0");
  const pubkeyY1 = BigInt("0x" + safeHex(paddedPubkey, 96, 32) || "0");

  console.log("Pubkey X0:", pubkeyX0.toString(16));
  console.log("Pubkey X1:", pubkeyX1.toString(16));
  console.log("Pubkey Y0:", pubkeyY0.toString(16));
  console.log("Pubkey Y1:", pubkeyY1.toString(16));

  // Hash to G1
  const hX = BigInt("0x" + messageHash.slice(0, 32));
  const hY = BigInt("0x" + (messageHash.slice(32, 64) || "0"));
  console.log("hX:", hX.toString(16));
  console.log("hY:", hY.toString(16));

  // Build input
  const input = "01" +
    "04" + sigX.toString(16).padStart(64, "0") + sigY.toString(16).padStart(64, "0") +
    "04" + G2_GENERATOR.x[0].toString(16).padStart(64, "0") + G2_GENERATOR.x[1].toString(16).padStart(64, "0") +
          G2_GENERATOR.y[0].toString(16).padStart(64, "0") + G2_GENERATOR.y[1].toString(16).padStart(64, "0") +
    "04" + hX.toString(16).padStart(64, "0") + hY.toString(16).padStart(64, "0") +
    "04" + pubkeyX0.toString(16).padStart(64, "0") + pubkeyX1.toString(16).padStart(64, "0") +
          pubkeyY0.toString(16).padStart(64, "0") + pubkeyY1.toString(16).padStart(64, "0");

  console.log("\nInput length:", input.length);

  // Use fetch for raw JSON-RPC
  try {
    const response = await fetch(config.INFURA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{
          to: "0x000000000000000000000000000000000000000F",
          data: "0x" + input
        }, "latest"],
        id: 1
      })
    });

    const json = await response.json();
    console.log("\nResult:", json.result);

    if (!json.result || json.result === "0x") {
      return { valid: false, error: "Empty result from precompile" };
    }

    const decoded = BigInt(json.result);
    console.log("Decoded:", decoded);
    return { valid: decoded === BigInt(1) };
  } catch (e: any) {
    console.error("Error:", e.message);
    return { valid: false, error: e.message };
  }
}

async function main() {
  const proofHex = process.argv[2];

  if (!proofHex) {
    console.log("Usage: npx tsx scripts/verify-bls-local.ts <proof_hex>");
    process.exit(1);
  }

  const proof = Buffer.from(proofHex.replace(/^0x/, ""), "hex");
  const data = parseProof(proof);

  console.log("=== Proof Data ===");
  console.log("Type:", data.proofType);
  console.log("Timestamp:", data.timestamp.toString());
  console.log("App hash:", data.appDataHash.toString("hex"));
  console.log("Handshake hash:", data.handshakeHash.toString("hex"));
  console.log("Sig len:", data.signature.length, "Pubkey len:", data.pubkey.length);

  const msgHash = ethers.keccak256(
    Buffer.concat([data.appDataHash, data.handshakeHash, Buffer.from(data.timestamp.toString(16).padStart(64, "0"), "hex")])
  ).replace(/^0x/, "");

  console.log("Message hash:", msgHash);

  const result = await verifyBLSProof(msgHash, data.signature, data.pubkey);

  console.log("\n=== Result ===");
  console.log("Valid:", result.valid);
  if (result.error) console.log("Error:", result.error);
}

main().catch(console.error);