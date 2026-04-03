# IS6200 - 去中心化 AI 内容验证系统

一个基于区块链的可信 AI 内容验证系统，通过 TLS Notary 证明和以太坊智能合约确保 AI 交互的真实性和完整性。

## 生产状态

| 组件 | 状态 | 说明 |
|------|------|------|
| 合约部署 | ✅ 完成 | Sepolia: `0x47db5ccac67fc66c7258b803525c76fe176698d6` |
| 链上验证 | ✅ 生产 | TLSN 证明类型验证 + 域名白名单验证 |
| 云服务器 Notary | ✅ 运行中 | 端口 7040/7041, IP: 101.33.252.78 |
| IPFS 上传 | ✅ 生产 | Pinata |

**最新交易**:
- 交易哈希: `0x68acc087abca60fddc858903a4083ca987890ba7c7d18746c4b3a819f7e19c65`
- IPFS: `QmPRSCuFKxU1mewgBRLfjAvbVfDzCLAFLUYF8vkkSqvXgu`
- TLSN 证明: 512 bytes
- 链上内容总数: 3 条

## 项目目标

本项目旨在实现一个**可靠的去中心化 AI 交流组件**，解决以下核心问题：

- **内容可信**: 通过 TLS Notary 技术验证 AI 服务商返回内容的真实性
- **透明可验证**: 所有内容提交记录上链，可公开审计
- **去中心化治理**: 域名白名单由多个管理员共同管理，防止单点控制

---

## 角色说明

| 角色 | 权限 | 说明 |
|------|------|------|
| **创建者 (Deployer)** | 部署合约、设置初始管理员 | 合约部署者，拥有合约初始控制权 |
| **管理员 (Admin)** | 签名白名单操作、执行操作 | 3/2 多签机制，需至少2人同意才能修改白名单 |
| **普通用户 (User)** | 提交内容、验证证明 | 可调用内容验证接口，将 AI 内容上链 |

---

## 使用流程

### 1. 创建者 - 部署阶段

```
┌─────────────────────────────────────────────────────────────┐
│  1. 编译并运行程序                                           │
│     cargo build && cargo run                                │
│                                                              │
│  2. 选择 "部署合约"                                          │
│     - 部署 TLSNContentVerifierWithMultisig.sol             │
│     - 指定3个管理员地址                                       │
│                                                              │
│  3. 保存合约地址到 .env                                       │
│     CONTRACT_ADDRESS=0x...                                   │
└─────────────────────────────────────────────────────────────┘
```

### 2. 管理员 - 白名单管理

```
┌─────────────────────────────────────────────────────────────┐
│  添加域名 (需3/2多签):                                       │
│                                                              │
│  1. 管理员A: 创建白名单操作                                   │
│     - 选择 "创建白名单操作"                                   │
│     - 输入域名: dashscope.aliyuncs.com                       │
│     - 选择 "添加域名"                                         │
│                                                              │
│  2. 管理员B: 签名同意                                        │
│     - 选择 "管理员签名操作"                                   │
│                                                              │
│  3. 管理员C (或B): 执行操作                                  │
│     - 选择 "执行白名单操作"                                   │
│     - 域名添加到链上白名单                                     │
└─────────────────────────────────────────────────────────────┘
```

### 3. 普通用户 - 内容提交

```
┌─────────────────────────────────────────────────────────────┐
│  提交 AI 内容上链:                                           │
│                                                              │
│  1. 输入提示词                                               │
│     (系统自动添加安全头部)                                     │
│                                                              │
│  2. 等待 AI 生成回复                                         │
│     - 调用阿里通义千问 API                                   │
│                                                              │
│  3. 生成 TLS Notary 证明                                      │
│     - 建立与 AI 服务商的 TLS 连接                            │
│     - 提取证书、握手信息、内容哈希                            │
│                                                              │
│  4. 上传 IPFS                                                │
│     - 内容存储到去中心化网络                                  │
│                                                              │
│  5. 链上验证                                                 │
│     - 合约验证证明有效性                                      │
│     - 验证提示词头部匹配                                      │
│     - 记录内容哈希和时间戳                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 技术方案详解

### 模块架构

```
┌────────────────────────────────────────────────────────────────────┐
│                         用户端 (Rust)                              │
├────────────────────────────────────────────────────────────────────┤
│  main.rs                                                           │
│    ├── config.rs       - 环境变量加载                              │
│    ├── ipfs.rs         - Pinata IPFS 集成                          │
│    ├── tlsn.rs         - TLS Notary 证明生成                       │
│    ├── submit_content.rs - AI 内容提交流程                          │
│    ├── manage_whitelist.rs - 白名单多签管理                         │
│    ├── deploy.rs       - 合约部署                                   │
│    └── contract.rs     - 合约交互接口                               │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                      区块链层 (Ethereum)                           │
├────────────────────────────────────────────────────────────────────┤
│  TLSNContentVerifierWithMultisig.sol                              │
│    ├── 域名白名单管理 (多签)                                        │
│    ├── TLSN 证明验证                                               │
│    └── 内容哈希存储                                               │
└────────────────────────────────────────────────────────────────────┘
```

### 1. TLS Notary 证明模块

本项目实现了两种TLSN证明模式：**本地模式** 和 **分布式模式**。

#### 1.1 本地模式 (`src/tlsn.rs`)

**技术方案**:
- 使用 `native-tls` 库建立与 AI 服务商的真实 TLS 连接
- 提取 TLS 握手信息：ClientHello、ServerRandom、证书
- 生成内容哈希：`keccak256(prompt + response)`
- 支持真实ECDSA签名（通过 `NOTARY_PRIVATE_KEY` 环境变量）

**证明结构**:
```rust
struct TlsnProof {
    proof_type: [u8; 32],           // keccak256("TLSN_PROOF_V1")
    timestamp: u64,                  // Unix 时间戳
    session_id: [u8; 32],            // 握手哈希作为会话ID
    client_hello_hash: [u8; 32],    // ClientHello 哈希
    server_certificate: Vec<u8>,     // DER 格式证书
    server_public_key_hash: [u8; 32], // 公钥哈希
    handshake_transcript_hash: [u8; 32], // 完整握手哈希
    application_data_hash: [u8; 32],    // AI 内容哈希
    client_random: [u8; 32],         // TLS 客户端随机数
    server_random: [u8; 32],         // TLS 服务器随机数
    notary_signature: Vec<u8>,       // Notary 签名
    notary_pubkey: [u8; 20],        // Notary 地址
}
```

#### 1.2 分布式模式 (`tlsn-lib/.../attestation_distributed/`)

**架构说明**:
```
┌─────────────────────────────────────────────────────────────────────┐
│                    分布式TLSN架构                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Port 7040 (TLSN Session)      Port 7041 (Attestation)              │
│  ┌──────────────────┐        ┌──────────────────┐                  │
│  │ MPC-TLS 验证     │        │ 接收Request      │                  │
│  │ 获取transcript  │◄──────►│ 读取共享状态     │                  │
│  │ 存储到Arc<Mutex>│ 共享    │ 构建Attestation  │                  │
│  │                  │ 状态    │ 返回签名结果     │                  │
│  └──────────────────┘        └──────────────────┘                  │
│                                                                     │
│  Prover (本地) ──────────────► Notary (云服务器)                   │
└─────────────────────────────────────────────────────────────────────┘
```

**核心组件**:

| 文件 | 功能 |
|------|------|
| `dist_notary.rs` | 分布式Notary服务器，双端口架构(7040/7041) |
| `dist_attestation_client.rs` | 统一Prover客户端，可连接任意HTTPS服务器 |
| `third_party_verify.rs` | 第三方验证工具，生成verification_proof.json |

**快速开始**:
```bash
# 启动分布式Notary（云服务器）
cargo run --example dist_notary

# 运行分布式Prover客户端
DASHSCOPE_API_KEY=your-key cargo run --example dist_attestation_client

# 第三方验证
cargo run --example third_party_verify -- attestation.bin request.bin proof.json
```

**支持的目标服务器**:
- 阿里云 dashscope (`dashscope.aliyuncs.com`)
- httpbin.org
- 任意HTTPS服务器（通过参数指定）

**输出文件**:
- `attestation_xxx.bin` - Notary签名的Attestation (bincode序列化)
- `attestation_request_xxx.bin` - 用于第三方验证的Request (bincode序列化)
- `verification_proof.json` - 第三方验证结果 (JSON格式)

#### 本地模式序列化格式 (Solidity bytes memory):
```
[offset 0-31]   数据长度 (uint32)
[offset 32-63]  proof_type (32 bytes)
[offset 64-95]  timestamp (32 bytes)
[offset 96-127] session_id (32 bytes)
...
[offset 32+]    所有字段紧凑排列
```

#### 分布式模式协议流程:
```
1. Prover连接Notary (7040) → MPC-TLS验证 → 存储transcript到共享状态
2. Prover通过Notary代理发送HTTP请求到目标服务器
3. Prover连接Notary (7041) → 发送AttestationRequest
4. Notary读取共享状态 → 构建Attestation → 返回签名结果
5. Prover验证Attestation → 保存到文件
```

### 2. 智能合约 (`contracts/TLSNContentVerifierWithMultisig.sol`)

**技术方案**:
- **Solidity 0.8.19**
- **多签机制**: 3/2 签名阈值，需至少 2 个管理员同意
- **白名单管理**: 域名哈希映射，add/remove 操作需多签
- **证明验证**: 验证 proof_type、时间戳有效性、签名存在

**核心函数**:

```solidity
// 白名单管理
function createPendingOperation(string memory _domain, bool _isAdd)
    external onlyAdmin returns (uint256 opId)

function signOperation(uint256 _opId) external onlyAdmin

function executeOperation(uint256 _opId) external onlyAdmin

// 内容验证
function verifyAndStoreContent(
    bytes32 _contentHash,
    string calldata _ipfsCid,
    string calldata _requestId,
    string calldata _fullPrompt,
    bytes memory _tlsnProof,
    bytes32 _expectedContentHash,
    bytes32 _domainHash
) external
```

### 3. IPFS 存储 (`src/ipfs.rs`)

**技术方案**:
- 使用 Pinata API 进行上传
- JSON 格式存储元数据

**存储结构**:
```rust
struct IpfsData {
    prompt_header: String,      // 提示词安全头部
    full_prompt: String,        // 完整提示词
    ai_content: String,         // AI 回复内容
    request_id: String,         // API 请求ID
    tlsn_proof: String,         // TLSN 证明 (hex)
    uploader: String,           // 上传者地址
    timestamp: u64,             // 上传时间
}
```

### 4. 合约交互 (`src/contract.rs`)

**技术方案**:
- 使用 `ethers-rs 2.0` 与以太坊交互
- `SignerMiddleware` 进行交易签名
- 动态加载合约 ABI

### 5. 配置管理 (`src/config.rs`)

**环境变量**:
| 变量 | 说明 |
|------|------|
| INFURA_URL | Sepolia RPC 端点 |
| CONTRACT_ADDRESS | 部署的合约地址 |
| PRIVATE_KEY | 用户钱包私钥 |
| ADMIN1/2/3_PRIVATE_KEY | 管理员私钥 |
| DASHSCOPE_API_KEY | 阿里千问 API Key |
| PINATA_API_KEY/SECRET | IPFS 上传密钥 |

---

## 快速开始

### 1. 环境配置

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 Node.js (用于合约)
nvm install 20

# 安装项目依赖
cd IS6200-Rust
cargo build
cd contracts && npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入配置
```

### 3. 运行

```bash
# 启动程序
cargo run
```

---

## 项目结构

```
IS6200-Rust/
├── .env.example              # 环境变量模板
├── Cargo.toml                # Rust 依赖配置
├── README.md                 # 本文件
├── WORK_RECORD.md            # 工作记录
├── query_chain_simple.py     # 链上查询脚本 (Python)
├── sync_and_test.sh          # 云服务器同步脚本
├── contracts/
│   ├── contracts/
│   │   └── TLSNContentVerifierWithMultisig.sol  # 智能合约
│   ├── hardhat.config.ts     # Hardhat 配置
│   └── scripts/              # 部署脚本
├── abi/                      # 合约 ABI
│   └── TLSNContentVerifierWithMultisig.json
├── src/
│   ├── main.rs               # 程序入口
│   ├── config.rs             # 配置管理
│   ├── contract.rs           # 合约交互
│   ├── ipfs.rs               # IPFS 集成
│   ├── tlsn_ai.rs            # TLS Notary AI 集成
│   ├── deploy.rs             # 合约部署
│   ├── manage_whitelist.rs   # 白名单多签管理
│   ├── submit_content.rs     # 内容提交
│   ├── query_chain.rs        # 链上查询
│   ├── diagnose_ecdsa.rs     # ECDSA 诊断工具
│   └── ai_api_config.rs      # AI API 配置
└── tlsn-lib/                 # 分布式TLSN库 (需单独克隆)
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **后端** | Rust, tokio (异步 runtime) |
| **区块链** | Ethereum (Sepolia), ethers-rs 2.0 |
| **智能合约** | Solidity 0.8.19 |
| **AI** | 阿里通义千问 (OpenAI 兼容 API) |
| **存储** | IPFS (Pinata) |
| **TLS** | native-tls, MPC-TLS (tlsn) |
| **工具** | Hardhat, Cargo |

### TLSN 依赖

| 组件 | 来源 |
|------|------|
| tlsn | GitHub (tlsnotary/tlsn) |
| k256 | crates.io (ECDSA签名) |
| hyper | crates.io (HTTP客户端) |

---

## 安全说明

1. **私钥安全**: 私钥存储在 .env，切勿提交到版本控制
2. **测试优先**: 建议在 Sepolia 测试网验证后再部署主网
3. **TLSN 实现**: 支持本地模式和分布式MPC-TLS模式，均可真实签名验证
4. **API 配额**: 阿里千问和 Pinata 有免费额度限制
5. **分布式部署**: Notary服务器需要公网可访问，防火墙开放7040/7041端口

---

## IPFS 内容防篡改机制

### 当前方案的安保能力

**是的，当前方案可以保证上传到 IPFS 的 AI 内容不被篡改**，通过三重验证机制：

### 三重保护机制

```
┌─────────────────────────────────────────────────────────────────────┐
│                    IPFS 内容防篡改体系                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  第1层: Notary 端 MPC-TLS 验证                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • Prover 与 Notary 通过 MPC 协议验证 TLS 连接              │   │
│  │ • 验证 AI 服务器证书真实性                                  │   │
│  │ • 验证握手信息完整性                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  第2层: Attestation 签名证明                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • Notary 对 handshake_hash 和 app_data_hash 签名           │   │
│  │ • 使用 secp256k1 ECDSA 私钥签名                             │   │
│  │ • 返回完整证明 (488 bytes) 包含签名 + 公钥                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  第3层: 链上 ECDSA 验证                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • 合约使用 ecrecover 恢复签名者地址                         │   │
│  │ • 验证签名者在 authorizedSigners 白名单中                   │   │
│  │ • Notary 地址: 0x1633542114D389a9b370c1c277E172a793f5c789   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 详细验证流程

1. **用户提交提示词** → Prover 直连 AI 服务器 (dashscope.aliyuncs.com)
2. **MPC-TLS 握手** → Notary 验证 TLS 连接真实性 (~67秒)
3. **生成 Attestation** → Notary 使用 ECDSA 私钥对内容哈希签名
4. **上传 IPFS** → 内容 + 证明 + 元数据存储到去中心化网络
5. **链上验证** → 合约验证 ECDSA 签名 + 白名单 + 时间戳过期

### 关键安全特性

| 验证项 | 实现方式 | 安全性 |
|--------|----------|--------|
| Notary 身份验证 | authorizedSigners 白名单 | 高 - 只有授权 Notary 可签名 |
| 签名验证 | secp256k1 ecrecover | 高 - 密码学安全 |
| 时间戳过期 | PROOF_EXPIRY = 86400秒 | 中 - 24小时内有效 |
| 域名验证 | whitelistedDomains | 中 - 需预先添加白名单 |

### 攻击者视角分析

如果攻击者试图篡改 IPFS 内容：

1. **修改 AI 内容** → 链上验证时 contentHash 不匹配 → 交易 revert
2. **替换证明** → 签名验证失败 (ecrecover 恢复地址不在白名单) → 交易 revert
3. **修改时间戳** → 合约检查 block.timestamp 与证明 timestamp 差异 → 交易 revert

### 潜在风险与限制

1. **Notary 私钥泄露** → 攻击者可伪造有效证明 → 需安全保管 Notary 私钥
2. **域名白名单绕过** → 需确保 addAuthorizedSigner 仅有受信任地址
3. **时间戳可预测** → 24小时窗口期 → 生产环境可缩短至 1小时

## 端到端工作流

```
用户输入提示词
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Prover 直连 AI 服务器 (dashscope.aliyuncs.com:443)              │
│    - MPC-TLS 协议与 Notary 协同验证 TLS 连接                       │
│    - 获取完整 TLS 握手信息 + AI 响应内容                           │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Notary 生成 Attestation 证明                                     │
│    - 计算: handshake_hash, app_data_hash                          │
│    - 使用 ECDSA 私钥签名                                            │
│    - 返回 488 bytes 证明 (签名 + 公钥 + 时间戳)                    │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. 上传 IPFS (Pinata)                                              │
│    - JSON 存储: prompt + content + proof + timestamp              │
│    - 获取 IPFS CID                                                  │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. 链上验证 + 存储                                                 │
│    - 验证 proof_type (TLSN_PROOF_V1)                              │
│    - 验证 timestamp 未过期 (24小时)                                 │
│    - ecrecover 验证 ECDSA 签名                                      │
│    - 验证签名者在 authorizedSigners 白名单                          │
│    - 存储 contentHash → IPFS CID 映射                              │
└─────────────────────────────────────────────────────────────────────┘
      │
      ▼
   交易成功 ✓
```

### 实际运行示例

```bash
# SSH 到云服务器
ssh -i "D:/Download/For_Agent.pem" ubuntu@101.33.252.78
export PATH=$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:$PATH

# 运行提交
cd /home/ubuntu/IS6200-Rust
cargo run -- --submit "你的提示词"

# 输出示例:
# 🎉 成功!
#    📋 交易哈希: 0x9a4c51a789c9e5ff3ccfda2523ead3a1bf6aa18a0795f8a9e4ea3407dfa4e2dc
#    📦 IPFS: https://gateway.pinata.cloud/ipfs/Qmej1ZUN4M7vbVZcK2K9agSgNQfi637b37cu8G9Nxvf4c9
#    🔐 TLSN 证明长度: 488 bytes
```
---

## 许可证

MIT License
