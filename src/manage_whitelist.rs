//! 多签白名单管理

use dialoguer::{Input, Select};
use ethers::signers::Signer;
use std::sync::Arc;
use thiserror::Error;

use crate::config::Config;
use crate::contract::{create_contract, load_abi};

#[derive(Error, Debug)]
pub enum WhitelistError {
    #[error("交易失败: {0}")]
    TxError(String),
    #[error("用户取消")]
    Cancelled,
}

pub async fn create_operation(config: &Config) -> Result<(), WhitelistError> {
    let domain: String = Input::new()
        .with_prompt("输入域名")
        .interact()
        .map_err(|_| WhitelistError::Cancelled)?;

    let is_add = Select::new()
        .with_prompt("操作")
        .items(&["添加", "移除"])
        .default(0)
        .interact()
        .map_err(|_| WhitelistError::Cancelled)?;

    let wallet = config.private_key
        .parse::<ethers::signers::LocalWallet>()
        .map_err(|e: <ethers::signers::LocalWallet as std::str::FromStr>::Err| WhitelistError::TxError(e.to_string()))?
        .with_chain_id(config.chain_id);

    let provider = Arc::new(ethers_middleware::SignerMiddleware::new(config.provider.clone(), wallet));
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json")
        .map_err(|e| WhitelistError::TxError(e.to_string()))?;

    let contract = create_contract(provider, config.contract_address, &abi)
        .map_err(|e| WhitelistError::TxError(e.to_string()))?;

    let call = contract
        .method::<_, ()>("createPendingOperation", (domain, is_add == 0))
        .map_err(|e| WhitelistError::TxError(e.to_string()))?;

    let pending = call.send().await.map_err(|e| WhitelistError::TxError(e.to_string()))?;
    let receipt = pending.await.map_err(|e| WhitelistError::TxError(e.to_string()))?;

    if let Some(r) = receipt {
        println!("\n✅ 成功! 交易: {:?}", r.transaction_hash);
    }
    Ok(())
}

pub async fn sign_operation(config: &Config) -> Result<(), WhitelistError> {
    let op_id: u64 = Input::new().with_prompt("操作ID").interact().map_err(|_| WhitelistError::Cancelled)?;
    let admin_idx = Select::new().with_prompt("管理员").items(&["1", "2", "3"]).default(0).interact().map_err(|_| WhitelistError::Cancelled)?;

    let wallet = config.admin_keys[admin_idx]
        .parse::<ethers::signers::LocalWallet>()
        .map_err(|e: <ethers::signers::LocalWallet as std::str::FromStr>::Err| WhitelistError::TxError(e.to_string()))?
        .with_chain_id(config.chain_id);

    let provider = Arc::new(ethers_middleware::SignerMiddleware::new(config.provider.clone(), wallet));
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json").map_err(|e| WhitelistError::TxError(e.to_string()))?;
    let contract = create_contract(provider, config.contract_address, &abi).map_err(|e| WhitelistError::TxError(e.to_string()))?;

    let call = contract.method::<_, ()>("signOperation", op_id).map_err(|e| WhitelistError::TxError(e.to_string()))?;
    let pending = call.send().await.map_err(|e| WhitelistError::TxError(e.to_string()))?;
    let receipt = pending.await.map_err(|e| WhitelistError::TxError(e.to_string()))?;

    if let Some(r) = receipt {
        println!("\n✅ 签名成功! 交易: {:?}", r.transaction_hash);
    }
    Ok(())
}

pub async fn execute_operation(config: &Config) -> Result<(), WhitelistError> {
    let op_id: u64 = Input::new().with_prompt("操作ID").interact().map_err(|_| WhitelistError::Cancelled)?;

    let wallet = config.private_key
        .parse::<ethers::signers::LocalWallet>()
        .map_err(|e: <ethers::signers::LocalWallet as std::str::FromStr>::Err| WhitelistError::TxError(e.to_string()))?
        .with_chain_id(config.chain_id);

    let provider = Arc::new(ethers_middleware::SignerMiddleware::new(config.provider.clone(), wallet));
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json").map_err(|e| WhitelistError::TxError(e.to_string()))?;
    let contract = create_contract(provider, config.contract_address, &abi).map_err(|e| WhitelistError::TxError(e.to_string()))?;

    let call = contract.method::<_, ()>("executeOperation", op_id).map_err(|e| WhitelistError::TxError(e.to_string()))?;
    let pending = call.send().await.map_err(|e| WhitelistError::TxError(e.to_string()))?;
    let receipt = pending.await.map_err(|e| WhitelistError::TxError(e.to_string()))?;

    if let Some(r) = receipt {
        println!("\n✅ 执行成功! 交易: {:?}", r.transaction_hash);
    }
    Ok(())
}