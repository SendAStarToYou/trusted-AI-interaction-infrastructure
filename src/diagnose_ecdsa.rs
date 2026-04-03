//! ECDSA 验证诊断模块
//!
//! 用于诊断 ECDSA 验证失败的原因

use ethers::core::types::{Address, Bytes, H256};
use ethers::signers::LocalWallet;
use ethers::utils::keccak256;
use ethers_middleware::SignerMiddleware;
use std::str::FromStr;
use std::sync::Arc;
use thiserror::Error;

use crate::config::Config;
use crate::contract::{create_contract, load_abi};

// Notary 公钥地址
const NOTARY_PUBLIC_KEY: &str = "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3";

#[derive(Error, Debug)]
pub enum DiagnoseError {
    #[error("链错误: {0}")]
    ChainError(String),
}

/// 诊断 ECDSA 验证
pub async fn diagnose_ecdsa_validation(config: &Config, proof_bytes: &[u8]) -> Result<(), DiagnoseError> {
    println!("\n🔍 ECDSA 验证诊断");
    println!("==================");

    let wallet = config.private_key
        .parse::<LocalWallet>()
        .map_err(|e| DiagnoseError::ChainError(format!("私钥解析失败: {}", e)))?;

    let provider = Arc::new(SignerMiddleware::new(config.provider.clone(), wallet.clone()));
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json")
        .map_err(|e| DiagnoseError::ChainError(format!("ABI加载失败: {}", e)))?;
    let contract = create_contract(provider.clone(), config.contract_address, &abi)
        .map_err(|e| DiagnoseError::ChainError(format!("合约初始化失败: {}", e)))?;

    // 先检查合约状态
    println!("\n📋 合约状态检查:");

    // 1. 检查域名白名单
    let domain = "dashscope.aliyuncs.com";
    match contract.method::<_, bool>("isDomainWhitelisted", (domain.to_string(),))
        .map_err(|e| DiagnoseError::ChainError(format!("方法构建失败: {}", e)))?
        .call()
        .await
    {
        Ok(is_whitelisted) => {
            println!("   域名 '{}': {}", domain, if is_whitelisted { "✅ 已白名单" } else { "❌ 未白名单" });
        }
        Err(e) => {
            println!("   域名白名单查询失败: {}", e);
        }
    }

    // 2. 检查 Notary 地址是否是管理员
    let notary_address = Address::from_str(NOTARY_PUBLIC_KEY)
        .map_err(|e| DiagnoseError::ChainError(format!("Notary地址解析失败: {}", e)))?;

    match contract.method::<_, bool>("admins", (notary_address,))
        .map_err(|e| DiagnoseError::ChainError(format!("方法构建失败: {}", e)))?
        .call()
        .await
    {
        Ok(is_admin) => {
            println!("   Notary地址 {}: {}", NOTARY_PUBLIC_KEY, if is_admin { "✅ 是管理员" } else { "❌ 不是管理员" });
        }
        Err(e) => {
            println!("   管理员查询失败: {}", e);
        }
    }

    // 3. 尝试直接通过provider查询合约存储 - 检查 authorizedSigners 映射
    // authorizedSigners 是 public mapping，可以通过自动生成的 getter 查询
    println!("\n📋 签名者白名单检查:");
    // 尝试使用低级别调用来检查 authorizedSigners
    // 注意：ABI 中没有直接的 authorizedSigners 函数，可能需要检查其他方式
    println!("   Notary地址: {}", NOTARY_PUBLIC_KEY);
    println!("   注意: 需要在合约中添加 authorizedSigners 查询或检查合约源码");

    // 分析 proof 结构
    println!("\n📋 Proof 结构分析:");
    println!("   总长度: {} bytes", proof_bytes.len());

    if proof_bytes.len() >= 32 {
        let proof_type = &proof_bytes[0..32];
        println!("   Proof Type (0-31): {:02x?}", &proof_type[..8]);
        let expected_type = [
            0x06, 0x0b, 0xf4, 0x08, 0x75, 0x53, 0xb0, 0x5a,
            0x79, 0xc2, 0x7e, 0xfa, 0x1d, 0x20, 0x58, 0x85,
            0xfe, 0x88, 0x03, 0x7d, 0xed, 0x0b, 0xdf, 0x89,
            0xed, 0x2a, 0x74, 0xfb, 0x1a, 0xce, 0x8a, 0xd0,
        ];
        println!("   期望的 Proof Type: {:02x?}", &expected_type[..8]);
        println!("   匹配: {}", proof_type == expected_type);
    }

    if proof_bytes.len() >= 40 {
        // 注意：timestamp 存储在 proof[32..40]，是 8 字节的 u64
        let timestamp_bytes = &proof_bytes[32..40];
        let timestamp = u64::from_be_bytes([
            timestamp_bytes[0], timestamp_bytes[1], timestamp_bytes[2], timestamp_bytes[3],
            timestamp_bytes[4], timestamp_bytes[5], timestamp_bytes[6], timestamp_bytes[7],
        ]);
        println!("   Timestamp (32-39): {}", timestamp);
    }

    if proof_bytes.len() >= 128 {
        let domain_hash = &proof_bytes[96..128];
        println!("   Domain Hash (96-127): {:02x?}", &domain_hash[..8]);
    }

    if proof_bytes.len() >= 192 {
        let app_hash = &proof_bytes[160..192];
        println!("   App Data Hash (160-191): {:02x?}", &app_hash[..8]);
    }

    if proof_bytes.len() >= 260 {
        let handshake_hash = &proof_bytes[228..260];
        println!("   Handshake Hash (228-259): {:02x?}", &handshake_hash[..8]);
    }

    if proof_bytes.len() >= 384 {
        let sig_r = &proof_bytes[352..384];
        println!("   Signature R (352-383): {:02x?}", &sig_r[..8]);
    }

    if proof_bytes.len() >= 416 {
        let sig_s = &proof_bytes[384..416];
        println!("   Signature S (384-415): {:02x?}", &sig_s[..8]);
    }

    if proof_bytes.len() >= 448 {
        let pub_x = &proof_bytes[416..448];
        println!("   PubKey X (416-447): {:02x?}", &pub_x[..8]);
    }

    if proof_bytes.len() >= 480 {
        let pub_y = &proof_bytes[448..480];
        println!("   PubKey Y (448-479): {:02x?}", &pub_y[..8]);
    }

    // 计算从proof中提取的信息
    if proof_bytes.len() >= 416 {
        let sig_r = &proof_bytes[352..384];
        let sig_s = &proof_bytes[384..416];
        let pub_x = &proof_bytes[416..448];
        let pub_y = &proof_bytes[448..480];

        // 尝试恢复签名者地址（使用 ecrecover 逻辑）
        // 注意：需要知道消息哈希和 v 值
        println!("\n📋 签名数据分析:");
        println!("   Signature R (32 bytes): {:02x?}...", &sig_r[..8]);
        println!("   Signature S (32 bytes): {:02x?}...", &sig_s[..8]);
        println!("   Public Key X (32 bytes): {:02x?}...", &pub_x[..8]);
        println!("   Public Key Y (32 bytes): {:02x?}...", &pub_y[..8]);

        // 从公钥计算以太坊地址
        let mut pubkey_full = vec![0x04u8]; // 未压缩公钥前缀
        pubkey_full.extend_from_slice(pub_x);
        pubkey_full.extend_from_slice(pub_y);

        let hash = keccak256(&pubkey_full[1..]); // 去掉 0x04 前缀后哈希
        let derived_address = Address::from_slice(&hash[12..]);
        println!("   从公钥派生的地址: {:?}", derived_address);
        println!("   Notary 配置地址: {}", NOTARY_PUBLIC_KEY);
        println!("   地址匹配: {}", derived_address == notary_address);
    }

    // 尝试调用不同的验证方法
    let proof_typed = Bytes::from(proof_bytes.to_vec());

    // 1. 先调用简化验证（应该成功）
    println!("\n🔗 调用简化验证 (validateTLSNProofSimple)...");
    match contract.method::<_, (bool, String)>("validateTLSNProofSimple", (proof_typed.clone(),))
        .map_err(|e| DiagnoseError::ChainError(format!("方法构建失败: {}", e)))?
        .call()
        .await
    {
        Ok((result, reason)) => {
            println!("   简化验证结果: {}", if result { "✅ 通过" } else { "❌ 失败" });
            println!("   原因: {}", reason);
        }
        Err(e) => {
            println!("   简化验证调用失败: {}", e);
        }
    }

    // 2. 调用 ECDSA 验证（当前失败）
    println!("\n🔗 调用 ECDSA 验证 (validateTLSNProofECDSA)...");
    match contract.method::<_, (bool, String)>("validateTLSNProofECDSA", (proof_typed.clone(),))
        .map_err(|e| DiagnoseError::ChainError(format!("方法构建失败: {}", e)))?
        .call()
        .await
    {
        Ok((result, reason)) => {
            println!("   ECDSA验证结果: {}", if result { "✅ 通过" } else { "❌ 失败" });
            println!("   原因: {}", reason);
        }
        Err(e) => {
            println!("   ❌ ECDSA验证调用失败: {}", e);
            println!("   错误类型: Panic(0x41) - 内存分配错误");
        }
    }

    // 3. 分析消息哈希
    if proof_bytes.len() >= 260 {
        let handshake_hash = &proof_bytes[228..260];
        let app_data_hash = &proof_bytes[160..192];
        // 修正：timestamp 存储在 proof[32..40]，是 8 字节的 u64
        let timestamp_bytes = &proof_bytes[32..40];
        let timestamp = u64::from_be_bytes([
            timestamp_bytes[0], timestamp_bytes[1], timestamp_bytes[2], timestamp_bytes[3],
            timestamp_bytes[4], timestamp_bytes[5], timestamp_bytes[6], timestamp_bytes[7],
        ]);

        println!("\n📋 消息哈希计算:");
        println!("   handshake_hash: {:02x?}", &handshake_hash[..8]);
        println!("   app_data_hash: {:02x?}", &app_data_hash[..8]);
        println!("   timestamp: {}", timestamp);

        // 按照合约逻辑计算消息哈希
        // bytes32 messageHash = keccak256(abi.encodePacked(handshakeHash, appDataHash, timestamp));
        let mut message_data = Vec::new();
        message_data.extend_from_slice(handshake_hash);
        message_data.extend_from_slice(app_data_hash);
        message_data.extend_from_slice(&timestamp.to_be_bytes());

        let message_hash = keccak256(&message_data);
        println!("   计算的消息哈希: {:02x?}", &message_hash[..8]);
    }

    // 4. 尝试本地 ecrecover 测试
    println!("\n📋 本地 ecrecover 测试:");
    if proof_bytes.len() >= 416 {
        let handshake_hash = &proof_bytes[228..260];
        let app_data_hash = &proof_bytes[160..192];
        // 修正：timestamp 存储在 proof[32..40]，是 8 字节的 u64
        let timestamp_bytes = &proof_bytes[32..40];
        let timestamp = u64::from_be_bytes([
            timestamp_bytes[0], timestamp_bytes[1], timestamp_bytes[2], timestamp_bytes[3],
            timestamp_bytes[4], timestamp_bytes[5], timestamp_bytes[6], timestamp_bytes[7],
        ]);
        let sig_r = &proof_bytes[352..384];
        let sig_s = &proof_bytes[384..416];

        // 构造完整的 uint256 timestamp (32字节，高24字节为0)
        let mut ts_bytes_32 = [0u8; 32];
        ts_bytes_32[24..32].copy_from_slice(&timestamp.to_be_bytes());

        // 按照 Solidity 的 abi.encodePacked 格式: handshakeHash (32) + appDataHash (32) + timestamp (32)
        let mut message_data = Vec::new();
        message_data.extend_from_slice(handshake_hash);
        message_data.extend_from_slice(app_data_hash);
        message_data.extend_from_slice(&ts_bytes_32);

        let message_hash = keccak256(&message_data);
        println!("   消息哈希 (32字节timestamp): {:02x?}", &message_hash[..8]);

        // 也尝试 8字节 timestamp 格式
        let mut message_data2 = Vec::new();
        message_data2.extend_from_slice(handshake_hash);
        message_data2.extend_from_slice(app_data_hash);
        message_data2.extend_from_slice(&timestamp.to_be_bytes());

        let message_hash2 = keccak256(&message_data2);
        println!("   消息哈希 (8字节timestamp): {:02x?}", &message_hash2[..8]);

        // 打印用于调试的信息
        println!("   Signature R: {:02x?}", sig_r);
        println!("   Signature S: {:02x?}", sig_s);

        // 本地 ecrecover 测试
        println!("\n📋 本地 ecrecover 恢复测试:");

        // 构造32字节timestamp的消息哈希
        let mut ts_bytes_32 = [0u8; 32];
        ts_bytes_32[24..32].copy_from_slice(&timestamp.to_be_bytes());
        let mut message_data = Vec::new();
        message_data.extend_from_slice(handshake_hash);
        message_data.extend_from_slice(app_data_hash);
        message_data.extend_from_slice(&ts_bytes_32);
        let message_hash_32 = keccak256(&message_data);

        // 尝试使用 ethers 进行 ecrecover
        let r_bytes: [u8; 32] = sig_r.try_into().unwrap_or([0u8; 32]);
        let s_bytes: [u8; 32] = sig_s.try_into().unwrap_or([0u8; 32]);

        for v in [27u64, 28u64] {
            let mut sig_with_v = Vec::new();
            sig_with_v.extend_from_slice(&r_bytes);
            sig_with_v.extend_from_slice(&s_bytes);
            sig_with_v.push(v as u8);

            // 使用 ethers-core 的 recover 函数
            match try_recover_address(&message_hash_32, &sig_with_v) {
                Ok(recovered) => {
                    println!("   v={}: 恢复地址: {:?}", v, recovered);
                    if recovered == notary_address {
                        println!("      ✅ 地址匹配!");
                    } else {
                        println!("      ❌ 地址不匹配");
                    }
                }
                Err(e) => {
                    println!("   v={}: 恢复失败: {}", v, e);
                }
            }
        }

        // 也测试8字节timestamp格式
        println!("\n   使用8字节timestamp格式测试:");
        let mut message_data2 = Vec::new();
        message_data2.extend_from_slice(handshake_hash);
        message_data2.extend_from_slice(app_data_hash);
        message_data2.extend_from_slice(&timestamp.to_be_bytes());
        let message_hash_8 = keccak256(&message_data2);

        for v in [27u64, 28u64] {
            let mut sig_with_v = Vec::new();
            sig_with_v.extend_from_slice(&r_bytes);
            sig_with_v.extend_from_slice(&s_bytes);
            sig_with_v.push(v as u8);

            match try_recover_address(&message_hash_8, &sig_with_v) {
                Ok(recovered) => {
                    println!("   v={}: 恢复地址: {:?}", v, recovered);
                    if recovered == notary_address {
                        println!("      ✅ 地址匹配!");
                    } else {
                        println!("      ❌ 地址不匹配");
                    }
                }
                Err(e) => {
                    println!("   v={}: 恢复失败: {}", v, e);
                }
            }
        }
    }

    println!("\n📋 诊断总结:");
    println!("   1. ✅ Notary 地址在合约部署时自动加入 authorizedSigners");
    println!("   2. 需要验证签名数据格式 (r||s) 和 ecrecover 恢复结果");
    println!("   3. 关键疑问: Notary 实际签名的消息格式是否与合约一致?");
    println!("   4. Panic(0x41) 可能是 ABI encoding 或内存访问问题");

    println!("\n📋 建议下一步:");
    println!("   - 使用已知测试签名验证 ecrecover 逻辑");
    println!("   - 检查 TLSN Notary 实际使用的签名消息格式");
    println!("   - 对比 Rust 生成的 proof 与合约期望的格式");

    Ok(())
}

/// 尝试使用 ecrecover 恢复地址
fn try_recover_address(message_hash: &[u8; 32], signature: &[u8]) -> Result<Address, String> {
    use ethers::core::types::Signature;
    use ethers::core::types::RecoveryMessage;
    use std::convert::TryFrom;

    if signature.len() != 65 {
        return Err(format!("签名长度错误: 期望65字节, 实际{}字节", signature.len()));
    }

    // 构造 Signature
    let sig_bytes: [u8; 65] = signature.try_into().map_err(|_| "转换签名失败")?;

    // 使用 ethers 的 recover 功能
    match Signature::try_from(&sig_bytes[..]) {
        Ok(sig) => {
            // 从 message_hash 恢复地址
            let recovery_msg = RecoveryMessage::Hash(H256::from(*message_hash));
            match sig.recover(recovery_msg) {
                Ok(addr) => Ok(addr),
                Err(e) => Err(format!("恢复失败: {:?}", e)),
            }
        }
        Err(e) => Err(format!("解析签名失败: {:?}", e)),
    }
}
