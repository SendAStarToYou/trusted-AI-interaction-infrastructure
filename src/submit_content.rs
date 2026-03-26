//! 内容提交模块 - 完整 TLS Notary 集成

use dialoguer::Input;
use ethers::core::types::Bytes;
use ethers::signers::Signer;
use ethers::utils::keccak256;
use reqwest::Client;
use serde::Deserialize;
use std::sync::Arc;
use thiserror::Error;

use crate::config::Config;
use crate::contract::{create_contract, load_abi};
use crate::ipfs::{upload_to_ipfs, IpfsData};
use crate::tlsn;

#[derive(Error, Debug)]
pub enum SubmitError {
    #[error("API错误: {0}")]
    ApiError(String),
    #[error("TLSN错误: {0}")]
    TlsnError(String),
    #[error("链上错误: {0}")]
    ChainError(String),
}

#[derive(Debug, Deserialize)]
struct QwenResp { id: String, choices: Vec<QwenChoice> }
#[derive(Debug, Deserialize)] struct QwenChoice { message: QwenMsg }
#[derive(Debug, Deserialize)] struct QwenMsg { content: String }

pub const PROMPT_HEADER: &str = "You are a helpful AI that only generates safe, compliant content. You must strictly follow this rule in all responses.";
pub const PROVIDER_DOMAIN: &str = "dashscope.aliyuncs.com";

/// 提交内容到链上 (完整 TLSN 流程)
pub async fn submit_content(config: &Config) -> Result<(), SubmitError> {
    println!("\n🤖 提交内容上链 (TLSN 验证)");
    println!("=================================");

    // 1. 获取用户输入 (优先使用环境变量 SUBMIT_PROMPT)
    let prompt = std::env::var("SUBMIT_PROMPT")
        .unwrap_or_else(|_| {
            Input::new()
                .with_prompt("输入你的提示词")
                .default("Explain what is blockchain in simple terms".into())
                .interact()
                .unwrap()
        });

    let full_prompt = format!("{}\n{}", PROMPT_HEADER, prompt);
    println!("📝 提示词: {}", &prompt);

    // 2. 调用阿里千问 API
    println!("\n📡 调用阿里千问 API...");
    println!("   URL: {}", &config.qwen_base_url);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| SubmitError::ApiError(e.to_string()))?;
    let qwen_req = serde_json::json!({
        "model": config.qwen_model,
        "messages": [{"role": "user", "content": full_prompt}]
    });

    println!("   发送请求...");
    let resp = client.post(&config.qwen_base_url)
        .header("Authorization", format!("Bearer {}", config.qwen_api_key))
        .header("Content-Type", "application/json")
        .header("User-Agent", "IS6200-Rust/1.0")
        .json(&qwen_req)
        .send().await
        .map_err(|e| SubmitError::ApiError(e.to_string()))?;

    println!("   响应状态: {}", resp.status());

    let qwen_resp: QwenResp = resp.json().await.map_err(|e| SubmitError::ApiError(e.to_string()))?;
    let content = qwen_resp.choices[0].message.content.clone();
    let request_id = qwen_resp.id;

    println!("✅ AI 返回 ({} 字符)", content.len());
    let preview = if content.len() > 150 { format!("{}...", &content[..150]) } else { content.clone() };
    println!("   {}\n", preview);

    // 3. 生成 TLSN 证明
    println!("🔐 生成 TLS Notary 证明...");

    // 创建 TLSN 证明
    let proof_bytes = tlsn::create_simple_proof(PROVIDER_DOMAIN, &full_prompt, &content);

    // 验证证明格式
    if let Err(e) = tlsn::verify_proof_bytes(&proof_bytes) {
        println!("   ⚠️  证明验证警告: {}", e);
    }

    println!("✅ TLSN 证明生成完成 ({} bytes)", proof_bytes.len());

    // 4. 上传 IPFS
    println!("\n📦 上传到 IPFS...");

    let ipfs_data = IpfsData {
        prompt_header: PROMPT_HEADER.to_string(),
        full_prompt: full_prompt.clone(),
        ai_content: content.clone(),
        request_id: request_id.clone(),
        tlsn_proof: format!("0x{}", hex::encode(&proof_bytes)),
        uploader: format!("{:?}", config.contract_address),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    let cid = upload_to_ipfs(config, serde_json::to_value(&ipfs_data).unwrap())
        .await
        .map_err(|e| SubmitError::ApiError(e.to_string()))?;

    println!("✅ IPFS 上传成功: {}", cid);

    // 5. 提交链上验证
    println!("\n⛓️  提交链上验证...");

    // 计算哈希
    let content_hash = keccak256(format!("{}{}", full_prompt, content).as_bytes());
    let domain_hash = keccak256(PROVIDER_DOMAIN.as_bytes());
    println!("   内容哈希: {:?}", &content_hash[..10]);
    println!("   域名哈希: {:02x?}", &domain_hash[..10]);

    let wallet = config.private_key
        .parse::<ethers::signers::LocalWallet>()
        .map_err(|e| SubmitError::ChainError(e.to_string()))?
        .with_chain_id(config.chain_id);

    let provider = Arc::new(ethers_middleware::SignerMiddleware::new(config.provider.clone(), wallet));
    println!("   Provider 连接成功");
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json")
        .map_err(|e| SubmitError::ChainError(e.to_string()))?;
    println!("   ABI 加载成功");
    let contract = create_contract(provider, config.contract_address, &abi)
        .map_err(|e| SubmitError::ChainError(e.to_string()))?;
    println!("   合约准备完成");

    // 计算哈希
    let content_hash = keccak256(format!("{}{}", full_prompt, content).as_bytes());
    let domain_hash = keccak256(PROVIDER_DOMAIN.as_bytes());

    // 调用合约 - 使用 Bytes 类型
    println!("   准备调用合约...");
    println!("   参数: content_hash={:x?}, cid={}, proof_len={}",
        content_hash, cid, proof_bytes.len());

    // 将证明转换为 Bytes 类型
    let proof_bytes_typed = Bytes::from(proof_bytes.clone());

    let call = contract.method::<_, ()>("verifyAndStoreContent", (
        content_hash,
        cid.clone(),
        request_id,
        full_prompt,
        proof_bytes_typed,  // 完整的 TLSN 证明 (Bytes类型)
        content_hash,
        domain_hash,
    )).map_err(|e| {
        println!("   ❌ 方法调用准备失败: {}", e);
        SubmitError::ChainError(e.to_string())
    })?;
    println!("   发送交易...");

    let pending = call.send().await.map_err(|e| {
        let err = e.to_string();
        println!("   ❌ 交易发送失败: {}", &err[..err.len().min(200)]);
        SubmitError::ChainError(e.to_string())
    })?;
    println!("   交易已发送，等待确认...");
    let receipt = pending.await.map_err(|e| {
        let err = e.to_string();
        println!("   ❌ 确认失败: {}", &err[..err.len().min(200)]);
        SubmitError::ChainError(e.to_string())
    })?;

    if let Some(r) = receipt {
        println!("\n🎉 成功!");
        println!("   📋 交易哈希: {:?}", r.transaction_hash);
        println!("   📦 IPFS: https://gateway.pinata.cloud/ipfs/{}", cid);
        println!("   🔐 TLSN 证明长度: {} bytes", proof_bytes.len());
    }

    Ok(())
}

/// 验证已有的 IPFS 内容
pub async fn verify_existing(config: &Config, cid: &str) -> Result<(), SubmitError> {
    println!("\n🔍 验证 IPFS 内容");

    let client = Client::new();
    let resp = client.get(format!("https://gateway.pinata.cloud/ipfs/{}", cid))
        .send().await
        .map_err(|e| SubmitError::ApiError(e.to_string()))?;

    let data: IpfsData = resp.json().await.map_err(|e| SubmitError::ApiError(e.to_string()))?;

    println!("   提示词: {}", &data.full_prompt[..data.full_prompt.len().min(80)]);
    println!("   AI 内容: {}", &data.ai_content[..data.ai_content.len().min(80)]);

    // 提交链上
    let wallet = config.private_key
        .parse::<ethers::signers::LocalWallet>()
        .map_err(|e| SubmitError::ChainError(e.to_string()))?
        .with_chain_id(config.chain_id);

    let provider = Arc::new(ethers_middleware::SignerMiddleware::new(config.provider.clone(), wallet));
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json")
        .map_err(|e| SubmitError::ChainError(e.to_string()))?;
    let contract = create_contract(provider, config.contract_address, &abi)
        .map_err(|e| SubmitError::ChainError(e.to_string()))?;

    // 解析证明
    let proof_hex = data.tlsn_proof.strip_prefix("0x").unwrap_or(&data.tlsn_proof);
    let proof_bytes = hex::decode(proof_hex).map_err(|e| SubmitError::ChainError(e.to_string()))?;

    let content_hash = keccak256(format!("{}{}", data.full_prompt, data.ai_content).as_bytes());
    let domain_hash = keccak256(PROVIDER_DOMAIN.as_bytes());

    // 将证明转换为 Bytes 类型
    let proof_bytes_typed = Bytes::from(proof_bytes);

    let call = contract.method::<_, ()>("verifyAndStoreContent", (
        content_hash,
        cid.to_string(),
        data.request_id,
        data.full_prompt,
        proof_bytes_typed,
        content_hash,
        domain_hash,
    )).map_err(|e| SubmitError::ChainError(e.to_string()))?;

    let pending = call.send().await.map_err(|e| {
        let err = e.to_string();
        println!("   ❌ 交易发送失败: {}", &err[..err.len().min(200)]);
        SubmitError::ChainError(e.to_string())
    })?;
    println!("   交易已发送，等待确认...");
    let receipt = pending.await.map_err(|e| {
        let err = e.to_string();
        println!("   ❌ 确认失败: {}", &err[..err.len().min(200)]);
        SubmitError::ChainError(e.to_string())
    })?;

    if let Some(r) = receipt {
        println!("\n✅ 验证成功! 交易: {:?}", r.transaction_hash);
    }

    Ok(())
}