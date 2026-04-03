# 第三方验证指南 - IPFS 内容与 TLSN 证明验证

本文档指导第三方如何独立验证存储在 IPFS 上的 AI 内容及其 TLS Notary 证明的真实性。

---

## 目录

1. [验证流程概览](#验证流程概览)
2. [查询 IPFS 内容](#查询-ipfs-内容)
3. [解析内容结构](#解析内容结构)
4. [验证 TLSN 证明](#验证-tlsn-证明)
5. [链上验证](#链上验证)
6. [常见问题](#常见问题)

---

## 验证流程概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    第三方验证流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 获取 IPFS CID                                              │
│     └─> 从交易收据、分享链接或区块链事件中获得                    │
│                                                                 │
│  2. 从 IPFS 网关获取内容                                         │
│     └─> GET https://gateway.pinata.cloud/ipfs/{CID}            │
│                                                                 │
│  3. 解析 JSON 内容                                              │
│     └─> 提取 prompt, ai_content, tlsn_proof                     │
│                                                                 │
│  4. 验证内容哈希                                                │
│     └─> keccak256(prompt + ai_content) == content_hash          │
│                                                                 │
│  5. (可选) 链上验证                                              │
│     └─> 调用合约验证 TLSN 证明                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 查询 IPFS 内容

### 方法 1: 使用公共 IPFS 网关

```bash
# 使用 Pinata 网关
curl "https://gateway.pinata.cloud/ipfs/QmZG2fHogLWN5CTpq6QLW3S61eUaxTqsQTUpRbB8gKKc26"

# 使用 IPFS.io 网关
curl "https://ipfs.io/ipfs/QmZG2fHogLWN5CTpq6QLW3S61eUaxTqsQTUpRbB8gKKc26"

# 使用 Cloudflare 网关
curl "https://cloudflare-ipfs.com/ipfs/QmZG2fHogLWN5CTpq6QLW3S61eUaxTqsQTUpRbB8gKKc26"
```

### 方法 2: 使用 JavaScript/TypeScript

```typescript
async function fetchIpfsContent(cid: string): Promise<IpfsData> {
  const gateways = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/'
  ];

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}${cid}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn(`Gateway ${gateway} failed, trying next...`);
    }
  }
  throw new Error('All gateways failed');
}

// 使用示例
const cid = 'QmZG2fHogLWN5CTpq6QLW3S61eUaxTqsQTUpRbB8gKKc26';
const data = await fetchIpfsContent(cid);
console.log(data.ai_content);
```

### 方法 3: 使用 Python

```python
import requests
import json

def fetch_ipfs_content(cid: str) -> dict:
    gateways = [
        'https://gateway.pinata.cloud/ipfs/',
        'https://ipfs.io/ipfs/',
        'https://cloudflare-ipfs.com/ipfs/'
    ]

    for gateway in gateways:
        try:
            url = f"{gateway}{cid}"
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Gateway {gateway} failed: {e}")
            continue

    raise Exception("All gateways failed")

# 使用示例
cid = "QmZG2fHogLWN5CTpq6QLW3S61eUaxTqsQTUpRbB8gKKc26"
data = fetch_ipfs_content(cid)
print(data['ai_content'])
```

---

## 解析内容结构

### IPFS 存储的数据格式

```typescript
interface IpfsData {
  // 提示词安全头部（系统提示）
  prompt_header: string;

  // 完整提示词（包含安全头部 + 用户输入）
  full_prompt: string;

  // AI 生成的回复内容
  ai_content: string;

  // API 请求 ID（用于追溯）
  request_id: string;

  // TLSN 证明（十六进制字符串）
  tlsn_proof: string;  // 例如: "0x060bf408..."

  // 上传者地址
  uploader: string;

  // 上传时间戳（Unix 秒）
  timestamp: number;
}
```

### 实际示例

```json
{
  "prompt_header": "You are a helpful AI that only generates safe, compliant content...",
  "full_prompt": "You are a helpful AI...\n简要解释什么是区块链，用中文",
  "ai_content": "区块链是一种**去中心化的分布式账本技术**...",
  "request_id": "req_1234567890",
  "tlsn_proof": "0x060bf4087553b05a79c27efa1d205885fe88037ded0bdf89ed2a74fb1ace8ad000000000000000000000000000000000000000000000000000000000000000000...",
  "uploader": "0x4202bBf7904C53eCf4ee07F121B13C0F7bc62Cb3",
  "timestamp": 1775011478
}
```

### 验证内容完整性

```typescript
import { keccak256, toUtf8Bytes } from 'ethers';

function verifyContentIntegrity(data: IpfsData): string {
  // 计算内容哈希
  const content = data.full_prompt + data.ai_content;
  const contentHash = keccak256(toUtf8Bytes(content));

  console.log('计算的内容哈希:', contentHash);
  return contentHash;
}
```

---

## 验证 TLSN 证明

### TLSN 证明结构 (488 bytes)

```
偏移量      字段                      大小
─────────────────────────────────────────────────
0-31        proof_type               32 bytes
32-63       timestamp                32 bytes
64-95       session_id               32 bytes
96-127      padding                  32 bytes
128-159     padding                  32 bytes
160-191     padding                  32 bytes
192-223     app_data_hash            32 bytes
224-227     padding                  4 bytes
228-259     padding                  32 bytes
260-291     handshake_hash           32 bytes
292-323     padding                  32 bytes
324-359     padding                  36 bytes
360-391     signature_r              32 bytes
392-423     signature_s              32 bytes
424-455     pubkey_x                 32 bytes
456-487     pubkey_y                 32 bytes
```

### 提取证明字段

```typescript
function parseTlsnProof(proofHex: string) {
  // 移除 0x 前缀
  const proof = proofHex.startsWith('0x')
    ? proofHex.slice(2)
    : proofHex;

  const bytes = Buffer.from(proof, 'hex');

  if (bytes.length !== 488) {
    throw new Error(`Invalid proof length: ${bytes.length}, expected 488`);
  }

  return {
    proof_type: bytes.slice(0, 32).toString('hex'),
    timestamp: BigInt('0x' + bytes.slice(32, 64).toString('hex')),
    app_data_hash: '0x' + bytes.slice(192, 224).toString('hex'),
    handshake_hash: '0x' + bytes.slice(260, 292).toString('hex'),
    signature_r: '0x' + bytes.slice(360, 392).toString('hex'),
    signature_s: '0x' + bytes.slice(392, 424).toString('hex'),
    pubkey_x: '0x' + bytes.slice(424, 456).toString('hex'),
    pubkey_y: '0x' + bytes.slice(456, 488).toString('hex')
  };
}

// 使用示例
const proofData = parseTlsnProof(ipfsData.tlsn_proof);
console.log('App Data Hash:', proofData.app_data_hash);
console.log('Handshake Hash:', proofData.handshake_hash);
```

### 验证证明类型

```typescript
function verifyProofType(proofType: string): boolean {
  // 计算预期的 proof_type
  const expectedV1 = keccak256(toUtf8Bytes('TLSN_PROOF_V1'));
  const expectedV0 = keccak256(toUtf8Bytes('TLSN_PROOF'));

  return (
    '0x' + proofType === expectedV1.toLowerCase() ||
    '0x' + proofType === expectedV0.toLowerCase()
  );
}
```

---

## 链上验证

### 合约信息

- **网络**: Sepolia 测试网
- **合约地址**: `0x48D9179Cea09552c601EbbabaaC50E341cB18153`
- **合约 ABI**: 见 [abi/TLSNContentVerifierWithMultisig.json](../abi/TLSNContentVerifierWithMultisig.json)

### 方法 1: 使用 Ethers.js 验证

```typescript
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';

// 合约 ABI（仅包含必要函数）
const CONTRACT_ABI = [
  {
    "inputs": [{"internalType": "bytes", "name": "_proof", "type": "bytes"}],
    "name": "validateTLSNProofSimple",
    "outputs": [
      {"internalType": "bool", "name": "valid", "type": "bool"},
      {"internalType": "string", "name": "reason", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes", "name": "_proof", "type": "bytes"}],
    "name": "validateTLSNProofECDSA",
    "outputs": [
      {"internalType": "bool", "name": "valid", "type": "bool"},
      {"internalType": "string", "name": "reason", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "_contentHash", "type": "bytes32"}],
    "name": "getContentRecord",
    "outputs": [
      {"internalType": "bytes32", "name": "contentHash", "type": "bytes32"},
      {"internalType": "string", "name": "ipfsCid", "type": "string"},
      {"internalType": "address", "name": "uploader", "type": "address"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "string", "name": "requestId", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function verifyOnChain(cid: string, ipfsData: IpfsData) {
  // 连接到 Sepolia 网络
  const provider = new JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');

  const contract = new Contract(
    '0x48D9179Cea09552c601EbbabaaC50E341cB18153',
    CONTRACT_ABI,
    provider
  );

  // 准备证明数据
  const proofBytes = ipfsData.tlsn_proof.startsWith('0x')
    ? ipfsData.tlsn_proof
    : '0x' + ipfsData.tlsn_proof;

  // 1. 验证 TLSN 证明（简化验证）
  console.log('验证 TLSN 证明...');
  const [simpleValid, simpleReason] = await contract.validateTLSNProofSimple(proofBytes);
  console.log('简化验证结果:', simpleValid, simpleReason);

  // 2. 验证 TLSN 证明（ECDSA 完整验证）
  const [ecdsaValid, ecdsaReason] = await contract.validateTLSNProofECDSA(proofBytes);
  console.log('ECDSA 验证结果:', ecdsaValid, ecdsaReason);

  // 3. 查询链上记录
  const contentHash = keccak256(toUtf8Bytes(ipfsData.full_prompt + ipfsData.ai_content));
  const record = await contract.getContentRecord(contentHash);
  console.log('链上记录:', {
    contentHash: record[0],
    ipfsCid: record[1],
    uploader: record[2],
    timestamp: Number(record[3]),
    requestId: record[4]
  });

  // 验证 IPFS CID 匹配
  if (record[1] === cid) {
    console.log('✅ IPFS CID 匹配');
  } else {
    console.log('❌ IPFS CID 不匹配');
  }

  return {
    simpleValid,
    ecdsaValid,
    onChainCid: record[1]
  };
}
```

### 方法 2: 使用 Web3.py 验证

```python
from web3 import Web3
import json

# 合约 ABI（仅包含必要函数）
CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "bytes", "name": "_proof", "type": "bytes"}],
        "name": "validateTLSNProofSimple",
        "outputs": [
            {"internalType": "bool", "name": "valid", "type": "bool"},
            {"internalType": "string", "name": "reason", "type": "string"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_contentHash", "type": "bytes32"}],
        "name": "getContentRecord",
        "outputs": [
            {"internalType": "bytes32", "name": "contentHash", "type": "bytes32"},
            {"internalType": "string", "name": "ipfsCid", "type": "string"},
            {"internalType": "address", "name": "uploader", "type": "address"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "string", "name": "requestId", "type": "string"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

def verify_on_chain(cid: str, ipfs_data: dict):
    # 连接到 Sepolia
    w3 = Web3(Web3.HTTPProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY'))

    contract_address = '0x48D9179Cea09552c601EbbabaaC50E341cB18153'
    contract = w3.eth.contract(address=contract_address, abi=CONTRACT_ABI)

    # 准备证明数据
    proof_bytes = ipfs_data['tlsn_proof']
    if not proof_bytes.startswith('0x'):
        proof_bytes = '0x' + proof_bytes

    # 1. 验证 TLSN 证明
    print('验证 TLSN 证明...')
    simple_valid, simple_reason = contract.functions.validateTLSNProofSimple(
        proof_bytes
    ).call()
    print(f'简化验证结果: {simple_valid}, {simple_reason}')

    # 2. 查询链上记录
    content = ipfs_data['full_prompt'] + ipfs_data['ai_content']
    content_hash = Web3.keccak(text=content).hex()

    record = contract.functions.getContentRecord(content_hash).call()
    print(f'链上记录:')
    print(f'  Content Hash: {record[0].hex()}')
    print(f'  IPFS CID: {record[1]}')
    print(f'  Uploader: {record[2]}')
    print(f'  Timestamp: {record[3]}')
    print(f'  Request ID: {record[4]}')

    # 验证 CID 匹配
    if record[1] == cid:
        print('✅ IPFS CID 匹配')
    else:
        print('❌ IPFS CID 不匹配')

    return {
        'simple_valid': simple_valid,
        'on_chain_cid': record[1]
    }
```

---

## 完整验证脚本

### 一站式验证工具

```typescript
// verify-content.ts
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';

interface VerificationResult {
  cid: string;
  ipfsAccessible: boolean;
  contentHashValid: boolean;
  proofTypeValid: boolean;
  timestampValid: boolean;
  onChainVerified: boolean;
  details: {
    contentHash: string;
    appDataHash: string;
    handshakeHash: string;
    timestamp: number;
    uploader: string;
  };
}

async function fullVerification(cid: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    cid,
    ipfsAccessible: false,
    contentHashValid: false,
    proofTypeValid: false,
    timestampValid: false,
    onChainVerified: false,
    details: {
      contentHash: '',
      appDataHash: '',
      handshakeHash: '',
      timestamp: 0,
      uploader: ''
    }
  };

  try {
    // 1. 获取 IPFS 内容
    console.log(`🔍 获取 IPFS 内容: ${cid}`);
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
    if (!response.ok) throw new Error('IPFS fetch failed');

    const data = await response.json();
    result.ipfsAccessible = true;
    result.details.uploader = data.uploader;
    result.details.timestamp = data.timestamp;

    // 2. 解析证明
    const proof = parseTlsnProof(data.tlsn_proof);
    result.details.appDataHash = proof.app_data_hash;
    result.details.handshakeHash = proof.handshake_hash;

    // 3. 验证 proof_type
    result.proofTypeValid = verifyProofType(proof.proof_type);
    console.log(`  Proof Type: ${result.proofTypeValid ? '✅' : '❌'}`);

    // 4. 验证时间戳（24小时有效期）
    const now = Math.floor(Date.now() / 1000);
    const proofTime = Number(proof.timestamp);
    result.timestampValid = proofTime === 0 || (now - proofTime) < 86400;
    console.log(`  Timestamp: ${result.timestampValid ? '✅' : '❌'}`);

    // 5. 计算内容哈希
    const contentHash = keccak256(
      toUtf8Bytes(data.full_prompt + data.ai_content)
    );
    result.details.contentHash = contentHash;
    result.contentHashValid = true;
    console.log(`  Content Hash: ✅`);

    // 6. 链上验证
    console.log(`⛓️  链上验证...`);
    const provider = new JsonRpcProvider('https://sepolia.infura.io/v3/YOUR_INFURA_KEY');
    const contract = new Contract(
      '0x48D9179Cea09552c601EbbabaaC50E341cB18153',
      CONTRACT_ABI,
      provider
    );

    const [valid, reason] = await contract.validateTLSNProofSimple(
      data.tlsn_proof
    );
    result.onChainVerified = valid;
    console.log(`  On-chain: ${valid ? '✅' : '❌'} ${reason}`);

    // 7. 验证链上记录
    const record = await contract.getContentRecord(contentHash);
    if (record[1] === cid) {
      console.log(`  CID Match: ✅`);
    }

  } catch (error) {
    console.error('验证失败:', error);
  }

  return result;
}

// 运行验证
const cid = process.argv[2] || 'QmZG2fHogLWN5CTpq6QLW3S61eUaxTqsQTUpRbB8gKKc26';
fullVerification(cid).then(result => {
  console.log('\n📊 验证结果:');
  console.log(JSON.stringify(result, null, 2));
});
```

---

## 常见问题

### Q1: IPFS 网关返回 504 超时怎么办？

**A**: 尝试以下方法：
1. 更换其他网关（ipfs.io, cloudflare-ipfs.com, dweb.link）
2. 使用本地 IPFS 节点
3. 等待内容传播（新上传的内容可能需要几分钟）

### Q2: 如何确认内容未被篡改？

**A**: 三重验证：
1. **IPFS CID 自验证**: CID 是内容的哈希，天然防篡改
2. **内容哈希验证**: 计算 `keccak256(prompt + content)` 与链上记录对比
3. **TLSN 证明验证**: 链上合约验证证明的有效性

### Q3: TLSN 证明过期怎么办？

**A**:
- 当前合约设置 `PROOF_EXPIRY = 86400` 秒（24小时）
- 如果 `timestamp = 0`，跳过过期检查
- 过期的证明仍可在 IPFS 查看，但链上新验证会失败

### Q4: 如何获取我的交易记录？

**A**:
```typescript
// 查询 ContentVerified 事件
const filter = contract.filters.ContentVerified();
const events = await contract.queryFilter(filter, fromBlock, toBlock);

for (const event of events) {
  console.log('Content Hash:', event.args.contentHash);
  console.log('IPFS CID:', event.args.ipfsCid);
  console.log('Uploader:', event.args.uploader);
}
```

### Q5: 验证失败的可能原因？

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| "Domain not whitelisted" | AI 服务商域名未授权 | 联系管理员添加白名单 |
| "Proof expired" | TLSN 证明超过24小时 | 重新生成证明 |
| "Invalid type" | 证明格式错误 | 检查证明字节长度是否为488 |
| "Hash mismatch" | 内容被篡改 | 验证 IPFS CID 是否匹配 |
| "ECDSA: invalid signature" | 签名验证失败 | 确认使用的是有效证明 |

---

## 参考资源

- **合约地址**: [Sepolia Etherscan](https://sepolia.etherscan.io/address/0x48D9179Cea09552c601EbbabaaC50E341cB18153)
- **IPFS 网关列表**: https://ipfs.github.io/public-gateway-checker/
- **TLS Notary 文档**: https://docs.tlsnotary.org/
- **项目源码**: https://github.com/your-repo/IS6200-Rust

---

*最后更新: 2026-04-01*
