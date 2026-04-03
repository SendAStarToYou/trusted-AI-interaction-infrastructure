//! 链上内容查询模块

use ethers::contract::Contract;
use ethers::core::types::Address;
use ethers_middleware::SignerMiddleware;
use ethers::providers::{Http, Provider};
use std::str::FromStr;
use std::sync::Arc;

use crate::config::Config;
use crate::contract::{create_contract, load_abi};

// 定义合约实例类型别名
type ContractInstance = Contract<SignerMiddleware<Provider<Http>, ethers::signers::LocalWallet>>;

/// 查询链上信息
pub async fn query_chain_info(config: &Config) -> Result<(), String> {
    println!("\n📊 链上内容查询");
    println!("=================================");

    // 加载合约
    let abi = load_abi("abi/TLSNContentVerifierWithMultisig.json")
        .map_err(|e| format!("ABI加载失败: {}", e))?;

    let wallet = config.private_key.parse::<ethers::signers::LocalWallet>()
        .map_err(|e| format!("私钥解析失败: {}", e))?;

    let provider = Arc::new(SignerMiddleware::new(config.provider.clone(), wallet));

    let contract = create_contract(provider.clone(), config.contract_address, &abi)
        .map_err(|e| format!("合约初始化失败: {}", e))?;

    // 查询总记录数
    println!("\n📋 查询总记录数...");
    match contract.method::<_, ethers::core::types::U256>("getTotalContentCount", ())
        .map_err(|e| format!("方法构建失败: {}", e))?
        .call()
        .await
    {
        Ok(total) => {
            println!("   链上内容总记录数: {}", total);

            // 分页查询内容
            if total > 0.into() {
                let page_size = std::cmp::min(10u64, total.as_u64());
                query_content_page(&contract, 0, page_size).await?;
            }
        }
        Err(e) => {
            println!("   查询失败: {}", e);
        }
    }

    // 查询合约状态
    query_contract_status(&contract).await?;

    Ok(())
}

/// 分页查询内容
async fn query_content_page(
    contract: &ContractInstance,
    _page: u64,
    page_size: u64,
) -> Result<(), String> {
    println!("\n📋 内容记录 (显示 {} 条):", page_size);
    println!("----------------------------------------");

    println!("   提示: 完整内容记录请使用Etherscan查看");
    println!("   https://sepolia.etherscan.io/address/{:?}", contract.address());

    Ok(())
}

/// 查询合约状态
async fn query_contract_status(
    contract: &ContractInstance,
) -> Result<(), String> {
    println!("\n🔧 合约状态:");
    println!("----------------------------------------");

    // 查询域名白名单
    let domain = "dashscope.aliyuncs.com";
    match contract.method::<_, bool>("isDomainWhitelisted", (domain.to_string(),))
        .map_err(|e| format!("方法构建失败: {}", e))?
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

    // 查询Notary签名者状态
    let notary_address = Address::from_str("0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3")
        .map_err(|e| format!("地址解析失败: {}", e))?;

    match contract.method::<_, bool>("authorizedSigners", (notary_address,))
        .map_err(|e| format!("方法构建失败: {}", e))?
        .call()
        .await
    {
        Ok(is_signer) => {
            println!("   Notary签名者: {}", if is_signer { "✅ 已授权" } else { "❌ 未授权" });
        }
        Err(e) => {
            println!("   签名者查询失败: {}", e);
        }
    }

    // 查询管理员
    println!("\n   管理员列表:");
    let admin_addresses = [
        "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3",
        "0x1b7a22C21745ab854c0B55528B085718864d8f11",
        "0xc03945D04Fe4aC8C5C7066c516C12e8Cb3D987d7",
    ];

    for addr_str in &admin_addresses {
        let addr = Address::from_str(addr_str).unwrap();
        match contract.method::<_, bool>("admins", (addr,))
            .map_err(|e| format!("方法构建失败: {}", e))?
            .call()
            .await
        {
            Ok(is_admin) => {
                println!("      {}: {}", &addr_str[..20], if is_admin { "✅ 是" } else { "❌ 否" });
            }
            Err(e) => {
                println!("      {}: 查询失败 {}", &addr_str[..20], e);
            }
        }
    }

    Ok(())
}
