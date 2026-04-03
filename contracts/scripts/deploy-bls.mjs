// Deploy and add whitelist using 2 funded wallets
import * as fs from "fs";

// Load .env manually
const envContent = fs.readFileSync("./.env", "utf-8");
console.log("First 200 chars:", envContent.slice(0, 200));
const config = {};
envContent.split(/\r?\n/).forEach(line => {
  if (line.includes('=')) {
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) config[key] = value;
  }
});
console.log("Config keys:", Object.keys(config));
console.log("PRIVATE_KEY:", config.PRIVATE_KEY ? "loaded" : "missing");

const { ethers } = await import("ethers");

// Helper to ensure private key has 0x prefix
const ensureHexPrefix = (key) => key.startsWith("0x") ? key : "0x" + key;

const provider = new ethers.JsonRpcProvider(config.INFURA_URL);

// Main funded wallet
const mainWallet = new ethers.Wallet(ensureHexPrefix(config.PRIVATE_KEY), provider);
console.log("Main wallet:", mainWallet.address);

// Check admin2 balance
const admin2 = new ethers.Wallet(ensureHexPrefix(config.ADMIN2_PRIVATE_KEY), provider);
console.log("Admin2:", admin2.address);

const admin2Balance = await provider.getBalance(admin2.address);
console.log("Admin2 balance:", ethers.formatEther(admin2Balance), "ETH");

// If admin2 has no balance, send some
if (admin2Balance < ethers.parseEther("0.001")) {
  console.log("Sending ETH to admin2...");
  const tx = await mainWallet.sendTransaction({
    to: admin2.address,
    value: ethers.parseEther("0.002")
  });
  await tx.wait();
  console.log("Sent 0.002 ETH to admin2");
}

// Now deploy with admin1, admin2, admin3
const admin1 = mainWallet; // Use main as admin1
const admin3 = new ethers.Wallet(ensureHexPrefix(config.ADMIN3_PRIVATE_KEY), provider);

console.log("\nDeploying with admins:", admin1.address, admin2.address, admin3.address);

// Read the artifact
const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/TLSNContentVerifierWithMultisig.sol/TLSNContentVerifierWithMultisig.json", "utf-8"));

const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, admin1);
const contract = await factory.deploy([admin1.address, admin2.address, admin3.address]);

await contract.waitForDeployment();
const address = await contract.getAddress();

console.log("Deployed to:", address);

// Add to whitelist using multi-sig (need 2 of 3 signatures)
const domain = "dashscope.aliyuncs.com";
console.log("\nAdding domain to whitelist:", domain);

// Create operation as admin1
let tx = await contract.createPendingOperation(domain, true);
await tx.wait();
console.log("Admin1: Created pending operation");

// Sign as admin1
tx = await contract.signOperation(0);
await tx.wait();
console.log("Admin1: Signed");

// Sign as admin2 (different wallet)
tx = await contract.connect(admin2).signOperation(0);
await tx.wait();
console.log("Admin2: Signed (threshold reached)");

// Execute as admin1
tx = await contract.executeOperation(0);
await tx.wait();
console.log("Admin1: Executed - domain added to whitelist");

// Verify
const isWhitelisted = await contract.isDomainWhitelisted(domain);
console.log("\nDomain whitelisted:", isWhitelisted);

// Save address
fs.writeFileSync("./deployment-address.txt", address);
console.log("\n=== New Contract Address ===");
console.log(address);
console.log("===========================");