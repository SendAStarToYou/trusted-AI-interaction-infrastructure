/**
 * BLS 签名验证脚本
 *
 * 用途：
 * 1. 验证TLSN返回的BLS签名
 * 2. 生成可在合约中验证的证明
 *
 * 生产环境考虑：
 * - 链下验证BLS签名（成本高）
 * - 生成简化的链上证明
 */

import { Bls12381G2KeyPair, verify } from "@thehubbleproject/bls";
import { randomBytes } from "crypto";

// 注意：这只是一个演示脚本
// 实际的TLSN签名验证需要正确处理以下内容：
// 1. BLS12-381 曲线参数
// 2. 正确的消息格式（keccak256(handshakeHash, appDataHash, ts)）
// 3. 正确的公钥格式（来自notary）

/**
 * 验证BLS签名
 * @param publicKeyBytes - BLS公钥（48字节，G2点）
 * @param messageHash - 要验证的消息哈希
 * @param signatureBytes - BLS签名（96字节，G1点）
 * @returns 是否验证通过
 */
export async function verifyBlsSignature(
  publicKeyBytes: Buffer,
  messageHash: Buffer,
  signatureBytes: Buffer
): Promise<boolean> {
  try {
    // 从字节创建密钥对（仅用于验证）
    const keyPair = await Bls12381G2KeyPair.fromBytes({
      sk: randomBytes(32),
      pk: publicKeyBytes,
    });

    const isValid = await verify(
      keyPair,
      messageHash,
      signatureBytes
    );

    return isValid;
  } catch (error) {
    console.error("BLS验证失败:", error);
    return false;
  }
}

/**
 * 生成链上验证证明
 *
 * 合约将验证：
 * 1. 签名者公钥哈希匹配
 * 2. 时间戳有效
 * 3. 消息哈希匹配
 *
 * 这种方法比直接在链上验证BLS更节省gas
 */
export interface OnChainProof {
  // 签名者公钥哈希（用于验证签名来自正确的notary）
  signerPubkeyHash: string;
  // 时间戳
  timestamp: number;
  // 握手哈希
  handshakeHash: string;
  // 应用数据哈希
  appDataHash: string;
  // BLS签名有效的证明（可以是任何形式的承诺）
  proofValid: boolean;
}

export function generateOnChainProof(
  notaryPubkey: Buffer,
  timestamp: number,
  handshakeHash: Buffer,
  appDataHash: Buffer,
  blsSignatureValid: boolean
): OnChainProof {
  // 计算公钥哈希
  const { keccak256 } = require("viem");
  const signerPubkeyHash = keccak256(notaryPubkey);

  return {
    signerPubkeyHash,
    timestamp,
    handshakeHash: "0x" + handshakeHash.toString("hex"),
    appDataHash: "0x" + appDataHash.toString("hex"),
    proofValid: blsSignatureValid,
  };
}

// 测试
async function main() {
  console.log("BLS 验证测试");
  console.log("注意: 这需要正确的TLSN公钥和签名格式");

  // 示例：创建测试密钥对
  const testKeyPair = await Bls12381G2KeyPair.generate();
  console.log("测试密钥对已生成");
  console.log("公钥:", Buffer.from(testKeyPair.publicKey).toString("hex").slice(0, 32) + "...");
}

main().catch(console.error);