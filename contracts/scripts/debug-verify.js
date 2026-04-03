import "dotenv/config";
import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.INFURA_URL);
  const contractAddress = process.env.CONTRACT_ADDRESS;

  const fs = await import("fs");
  const artifact = JSON.parse(
    fs.readFileSync(
      "./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json",
      "utf8"
    )
  );

  const contract = new ethers.Contract(contractAddress, artifact.abi, provider);

  const { keccak256, zeroPadValue } = ethers;

  const domain = "dashscope.aliyuncs.com";
  const prompt = "Hello";
  const response = "Hi there!";

  const clientRandom = keccak256(ethers.toUtf8Bytes("client_random"));
  const serverRandom = keccak256(ethers.toUtf8Bytes("server_random"));
  const certData = "CERTIFICATE_FOR_" + domain;
  const cert = ethers.toUtf8Bytes(certData);
  const pubkeyHash = keccak256(cert);
  const handshakeHash = keccak256(ethers.toUtf8Bytes(prompt + response));

  const timestamp = Math.floor(Date.now() / 1000);

  let signingKey = process.env.NOTARY_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!signingKey.startsWith("0x")) {
    signingKey = "0x" + signingKey;
  }

  const wallet = new ethers.Wallet(signingKey, provider);

  const appData = prompt + "|" + response;
  const appHash = keccak256(ethers.toUtf8Bytes(appData));

  // 签名数据
  const tsHex = "00000000000000000000000000000000" + timestamp.toString(16);
  const sigData = handshakeHash + appHash.slice(2) + tsHex;
  const sigHash = keccak256("0x" + sigData);

  const signature = await wallet.signMessage(ethers.getBytes(sigHash));
  const sigParts = ethers.Signature.from(signature);

  const proofTypeHash = keccak256(ethers.toUtf8Bytes("TLSN_PROOF_V1"));
  const sessionId = keccak256(ethers.toUtf8Bytes(domain + prompt + timestamp));
  const helloData = "CLIENT_HELLO|" + domain;
  const helloHash = keccak256(ethers.toUtf8Bytes(helloData));

  const notaryAddress = wallet.address.toLowerCase().replace("0x", "");
  const notaryPubkey = "0x" + notaryAddress.slice(-40);

  const certLenHex = cert.length.toString(16).padStart(8, '0');
  const sigLenHex = "00000041"; // 65 in hex

  const proof = "0x" +
    proofTypeHash.slice(2) +
    tsHex +
    sessionId.slice(2) +
    helloHash.slice(2) +
    certLenHex +
    Buffer.from(cert).toString("hex") +
    pubkeyHash.slice(2) +
    handshakeHash.slice(2) +
    clientRandom.slice(2) +
    serverRandom.slice(2) +
    sigLenHex +
    sigParts.r.slice(2) +
    sigParts.s.slice(2) +
    sigParts.v.toString(16).padStart(2, '0') +
    notaryAddress;

  console.log("Proof length:", proof.length / 2);
  console.log("Notary address:", wallet.address);

  try {
    const result = await contract.validateTLSNProof(proof);
    console.log("Validation result:", result);
  } catch (e) {
    console.log("Validation error:", e.message.slice(0, 300));
  }
}

main();