//! IPFS 模块

use reqwest::Client;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::config::Config;

#[derive(Error, Debug)]
pub enum IpfsError {
    #[error("请求失败: {0}")]
    RequestError(#[from] reqwest::Error),
    #[error("API错误: {0}")]
    ApiError(String),
}

#[derive(Debug, Deserialize, Serialize)]
pub struct IpfsData {
    pub prompt_header: String,
    pub full_prompt: String,
    pub ai_content: String,
    pub request_id: String,
    pub tlsn_proof: String,
    pub uploader: String,
    pub timestamp: u64,
}

#[derive(Debug, Deserialize)]
struct PinataResponse {
    #[serde(rename = "IpfsHash")]
    ipfs_hash: String,
}

pub async fn upload_to_ipfs(config: &Config, data: serde_json::Value) -> Result<String, IpfsError> {
    let client = Client::new();
    let response = client
        .post("https://api.pinata.cloud/pinning/pinJSONToIPFS")
        .header("pinata_api_key", &config.pinata_api_key)
        .header("pinata_secret_api_key", &config.pinata_secret)
        .json(&data)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(IpfsError::ApiError(format!("Status: {}", response.status())));
    }

    let json: PinataResponse = response.json().await?;
    Ok(json.ipfs_hash)
}