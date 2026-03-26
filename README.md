# IS6200 Rust 版 - TLS Notary + 多签白名单 + 阿里通义千问

基于 Rust 重构的区块链课程项目，实现了 TLS Notary 公证、3/2 多签白名单管理和阿里通义千问 AI 集成。

## 功能特性

- **TLS Notary**: 生成内容真实性证明
- **多签白名单**: 3/2 多签机制管理 AI 服务商域名
- **阿里千问**: OpenAI 兼容接口，无缝切换
- **IPFS 存储**: 去中心化内容存储
- **链上验证**: 以太坊智能合约验证

## 快速开始

### 1. 安装 Rust

```bash
# 使用 rustup 安装
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. 配置环境

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env 填入你的配置
# - INFURA_URL: Sepolia 测试网 URL
# - PRIVATE_KEY: 测试网私钥
# - DASHSCOPE_API_KEY: 阿里千问 API Key
# - PINATA_API_KEY/SECRET: IPFS 上传密钥
# - ADMIN_ADDRESSES: 3个管理员地址 (逗号分隔)
# - ADMIN1/2/3_PRIVATE_KEY: 管理员私钥
```

### 3. 编译运行

```bash
# 编译
cargo build --release

# 运行
cargo run --release
```

## 使用流程

### 步骤 1: 部署合约

1. 运行程序，选择 "部署合约"
2. 等待编译和部署完成
3. 复制显示的合约地址到 `.env` 的 `CONTRACT_ADDRESS`

### 步骤 2: 添加域名到白名单

1. 选择 "创建白名单操作"
2. 输入域名: `dashscope.aliyuncs.com`
3. 选择 "添加域名到白名单"
4. 管理员 1、2 分别选择 "管理员签名操作"
5. 任意管理员选择 "执行白名单操作"

### 步骤 3: 提交内容上链

1. 选择 "提交千问内容上链"
2. 输入提示词
3. 等待 AI 生成、内容证明、IPFS 上传和链上验证

## 项目结构

```
IS6200-Rust/
├── .env.example           # 环境变量示例
├── Cargo.toml             # Rust 依赖
├── README.md              # 本文件
├── contracts/
│   └── TLSNContentVerifierWithMultisig.sol  # 智能合约
├── abi/                   # 编译后的 ABI (自动生成)
└── src/
    ├── main.rs            # 入口
    ├── config.rs          # 配置
    ├── contract.rs        # 合约交互
    ├── ipfs.rs            # IPFS 上传
    ├── deploy.rs          # 部署
    ├── manage_whitelist.rs # 白名单管理
    └── submit_content.rs  # 千问 + TLSN
```

## 技术栈

- **语言**: Rust
- **以太坊**: ethers-rs 2.0
- **AI**: 阿里通义千问 (OpenAI 兼容)
- **存储**: IPFS (Pinata)
- **异步**: tokio
- **智能合约**: Solidity

## 配置说明

| 变量 | 说明 | 示例 |
|------|------|------|
| INFURA_URL | Sepolia RPC URL | https://sepolia.infura.io/v3/xxx |
| CONTRACT_ADDRESS | 部署后获得的合约地址 | 0x1234... |
| CHAIN_ID | 链 ID (Sepolia=11155111) | 11155111 |
| DASHSCOPE_API_KEY | 阿里云 DashScope API Key | sk-xxx |
| DASHSCOPE_MODEL | 千问模型 | qwen-turbo |
| PINATA_API_KEY | Pinata API Key | xxx |
| ADMIN_ADDRESSES | 3个管理员地址 (逗号分隔) | 0xAddr1,0xAddr2,0xAddr3 |

## 注意事项

1. 私钥安全: 不要提交到 Git，添加到 .gitignore
2. 测试网: 建议先在 Sepolia 测试网验证
3. TLS Notary: 当前为简化实现，仅生成哈希证明
4. API 额度: 阿里千问和 Pinata 有免费额度限制

## 许可证

MIT License