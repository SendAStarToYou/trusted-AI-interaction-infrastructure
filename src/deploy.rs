//! 部署模块

use thiserror::Error;

#[derive(Error, Debug)]
pub enum DeployError {
    #[error("ABI未找到")]
    NoAbi,
}

pub async fn deploy_contract(_config: &crate::config::Config) -> Result<(), DeployError> {
    if !std::path::Path::new("abi/TLSNContentVerifierWithMultisig.json").exists() {
        println!("⚠️  ABI 文件不存在: abi/TLSNContentVerifierWithMultisig.json");
        println!();
        println!("请使用 Hardhat 或 Foundry 部署合约:");
        println!("  npx hardhat run scripts/deploy.js --network sepolia");
        println!("  forge create contracts/TLSNContentVerifierWithMultisig.sol");
        println!();
        println!("然后将 ABI JSON 复制到 abi/ 目录");
        return Err(DeployError::NoAbi);
    }
    println!("✅ ABI 文件已就绪");
    println!();
    println!("部署功能需要 solc 集成。请使用 Hardhat/Foundry 部署后，");
    println!("将 CONTRACT_ADDRESS 填入 .env 文件。");
    Ok(())
}