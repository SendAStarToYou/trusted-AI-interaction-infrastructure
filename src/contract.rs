//! 合约辅助

use ethers::{
    contract::{BaseContract, Contract},
    middleware::Middleware,
    types::Address,
};
use std::sync::Arc;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("ABI加载失败: {0}")]
    AbiLoadError(String),
}

pub fn load_abi(path: &str) -> Result<String, ContractError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| ContractError::AbiLoadError(e.to_string()))?;
    if let Ok(abi_json) = serde_json::from_str::<serde_json::Value>(&content) {
        if let Some(abi) = abi_json.get("abi") {
            return serde_json::to_string(abi)
                .map_err(|e| ContractError::AbiLoadError(e.to_string()));
        }
    }
    Ok(content)
}

pub fn create_contract<M: Middleware + 'static>(
    provider: Arc<M>,
    address: Address,
    abi_str: &str,
) -> Result<Contract<M>, ContractError> {
    // 直接解析 JSON ABI
    let abi: ethers::abi::Abi = serde_json::from_str(abi_str)
        .map_err(|e| ContractError::AbiLoadError(e.to_string()))?;
    let base = BaseContract::from(abi);
    Ok(Contract::new(address, base, provider))
}