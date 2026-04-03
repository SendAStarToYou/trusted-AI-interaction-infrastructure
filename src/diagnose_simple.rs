//! 简化诊断模块

use ethers::core::types::Bytes;
use std::sync::Arc;
use crate::config::Config;
use crate::contract::{create_contract, load_abi};

pub async fn simple_diagnose(config: &Config, proof_bytes: &[u8]) -> Result<(), String> {
    println!("\n🔍 简化诊断 - 调用 validateTLSNProofSimple");

    let provider = Arc::new(config.provider.clone());
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json")
        .map_err(|e| format!("ABI加载失败: {}", e))?;
    let contract = create_contract(provider, config.contract_address, &abi)
        .map_err(|e| format!("合约初始化失败: {}", e))?;

    let proof = Bytes::from(proof_bytes.to_vec());

    println!("调用 validateTLSNProofSimple...");
    let result: (bool, String) = contract
        .method("validateTLSNProofSimple", (proof,))
        .map_err(|e| format!("方法调用失败: {}", e))?
        .call()
        .await
        .map_err(|e| format!("调用失败: {}", e))?;

    println!("简化验证结果: {}", result.0);
    println!("原因: {}", result.1);

    Ok(())
}
