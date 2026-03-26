//! 配置模块

use ethers::{
    providers::{Http, Provider},
    types::Address,
};
use std::env;
use std::str::FromStr;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("环境变量缺失: {0}")]
    MissingEnvVar(String),
    #[error("无效地址: {0}")]
    InvalidAddress(String),
}

#[derive(Debug, Clone)]
pub struct Config {
    pub provider: Provider<Http>,
    pub chain_id: u64,
    pub private_key: String,
    pub contract_address: Address,
    pub qwen_api_key: String,
    pub qwen_base_url: String,
    pub qwen_model: String,
    pub pinata_api_key: String,
    pub pinata_secret: String,
    pub admin_addresses: Vec<Address>,
    pub admin_keys: Vec<String>,
    pub tlsn_host: String,
    pub tlsn_port: u16,
}

impl Config {
    pub fn load() -> Result<Self, ConfigError> {
        dotenv::dotenv().ok();

        let infura_url = env::var("INFURA_URL").map_err(|_| ConfigError::MissingEnvVar("INFURA_URL".into()))?;
        let provider = Provider::<Http>::try_from(&infura_url).map_err(|e| ConfigError::InvalidAddress(e.to_string()))?;
        let chain_id = env::var("CHAIN_ID").map_err(|_| ConfigError::MissingEnvVar("CHAIN_ID".into()))?
            .parse().map_err(|_| ConfigError::InvalidAddress("CHAIN_ID".into()))?;

        let private_key = env::var("PRIVATE_KEY").map_err(|_| ConfigError::MissingEnvVar("PRIVATE_KEY".into()))?;
        let contract_address = Address::from_str(&env::var("CONTRACT_ADDRESS").map_err(|_| ConfigError::MissingEnvVar("CONTRACT_ADDRESS".into()))?)
            .map_err(|_| ConfigError::InvalidAddress("CONTRACT_ADDRESS".into()))?;

        let qwen_api_key = env::var("DASHSCOPE_API_KEY").map_err(|_| ConfigError::MissingEnvVar("DASHSCOPE_API_KEY".into()))?;
        let qwen_base_url = env::var("DASHSCOPE_BASE_URL").map_err(|_| ConfigError::MissingEnvVar("DASHSCOPE_BASE_URL".into()))?;
        let qwen_model = env::var("DASHSCOPE_MODEL").map_err(|_| ConfigError::MissingEnvVar("DASHSCOPE_MODEL".into()))?;

        let pinata_api_key = env::var("PINATA_API_KEY").map_err(|_| ConfigError::MissingEnvVar("PINATA_API_KEY".into()))?;
        let pinata_secret = env::var("PINATA_SECRET").map_err(|_| ConfigError::MissingEnvVar("PINATA_SECRET".into()))?;

        let admin_addresses: Vec<Address> = env::var("ADMIN_ADDRESSES").map_err(|_| ConfigError::MissingEnvVar("ADMIN_ADDRESSES".into()))?
            .split(',').map(|s| Address::from_str(s.trim()).map_err(|_| ConfigError::InvalidAddress(s.to_string())))
            .collect::<Result<Vec<_>, _>>()?;

        let admin_keys = vec![
            env::var("ADMIN1_PRIVATE_KEY").map_err(|_| ConfigError::MissingEnvVar("ADMIN1_PRIVATE_KEY".into()))?,
            env::var("ADMIN2_PRIVATE_KEY").map_err(|_| ConfigError::MissingEnvVar("ADMIN2_PRIVATE_KEY".into()))?,
            env::var("ADMIN3_PRIVATE_KEY").map_err(|_| ConfigError::MissingEnvVar("ADMIN3_PRIVATE_KEY".into()))?,
        ];

        let tlsn_host = env::var("TLSN_NOTARY_HOST").map_err(|_| ConfigError::MissingEnvVar("TLSN_NOTARY_HOST".into()))?;
        let tlsn_port: u16 = env::var("TLSN_NOTARY_PORT").map_err(|_| ConfigError::MissingEnvVar("TLSN_NOTARY_PORT".into()))?
            .parse().map_err(|_| ConfigError::InvalidAddress("TLSN_NOTARY_PORT".into()))?;

        Ok(Self {
            provider, chain_id, private_key, contract_address,
            qwen_api_key, qwen_base_url, qwen_model,
            pinata_api_key, pinata_secret,
            admin_addresses, admin_keys,
            tlsn_host, tlsn_port,
        })
    }
}