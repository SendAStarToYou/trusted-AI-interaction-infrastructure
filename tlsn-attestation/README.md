# TLSN-Attestation 分布式 TLSN 集成文档

## 核心任务

将分布式 TLSN 集成到 IS6200-Rust 项目，实现分布式 MPC-TLS 验证和证明生成。

### 安全特性
- Prover 直接连接 AI 服务器，HTTP 流量不过 Notary
- Notary 通过 MPC 获取哈希承诺，无法还原 HTTP 明文
- API Key 不会泄露给 Notary

---

## 组件架构

```
┌─────────────┐     MPC-TLS      ┌─────────────┐
│   Prover    │◄────────────────►│   Notary    │
│ (本项目)    │   (端口 7040)     │ (云服务器)  │
└──────┬──────┘                   └─────────────┘
       │
       │ 直连 (不过 Notary)
       ▼
┌─────────────┐    HTTPS     ┌─────────────┐
│ AI Server   │◄────────────►│ DashScope   │
│ (dashscope) │              │             │
└─────────────┘              └─────────────┘
       │
       │ Attestation
       ▼
┌─────────────────────────────────────────┐
│  证明包含:                              │
│  - TLS 握手数据 (证书链, SNI, 签名)     │
│  - HTTP 请求/响应 transcript            │
│  - bincode 序列化                       │
└─────────────────────────────────────────┘
```

### 端口说明
- **7040**: TLSN Session 端口 (Prover 与 Notary 之间的 MPC-TLS)
- **7041**: Attestation 端口 (获取最终证明)

---

## 云服务器组件

| 组件 | 位置 | 说明 |
|------|------|------|
| dist_notary | /home/ubuntu/tlsn-lib | MPC-TLS Notary 服务 |
| dist_attestation_client | /home/ubuntu/tlsn-lib | 官方示例客户端 (参考) |
| IS6200-Rust | /home/ubuntu/IS6200-Rust | 主项目 |

### Notary 启动命令
```bash
cd /home/ubuntu/tlsn-lib
cargo run --example dist_notary &
```

---

## 验证项完成情况

| 验证项 | 状态 | 说明 |
|--------|------|------|
| Notary 服务启动 | ✅ | 端口 7040/7041 正常运行 |
| MPC-TLS 连接 | ✅ | ~67秒完成 |
| Prover 直连 AI | ✅ | dashscope.aliyuncs.com:443 |
| TLS 连接建立 | ✅ | |
| HTTP 客户端握手 | ✅ | |
| Attestation 生成 | ✅ | 346 bytes |
| Attestation 验证 | ✅ | |
| 格式转换 | ✅ | bincode 序列化 |
| 完整流程测试 | ❌ | 链上验证待测试 |

---

## 关键配置

### 云服务器
- IP: 101.33.252.78
- SSH: `ssh -i "D:/Download/For_Agent.pem" ubuntu@101.33.252.78`
- Rust: `/home/ubuntu/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin`

### Notary 配置
```env
TLSN_NOTARY_HOST=127.0.0.1
TLSN_NOTARY_PORT=7040
```

### 编译命令
```bash
export PATH=$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:$PATH
cd /home/ubuntu/IS6200-Rust
cargo build
```

---

## 遗留问题与解决方案

### 问题 1: DashScope API 返回 400 错误

**现象**:
```
响应状态: 400 Bad Request
{"code":"InvalidParameter","message":"url error, please check url"}
```

**curl 直接调用成功**，TLSN 代理请求失败

**已尝试方案**:
1. ✅ 添加 `Connection: close` header
2. ✅ 切换到 compatible-mode 端点 `/compatible-mode/v1/chat/completions`

**解决**: 使用 compatible-mode (OpenAI 兼容格式) 替代原生 text-generation API

---

### 问题 2: 链上验证失败

**现象**:
```
Contract call reverted: TLSN invalid:
```

**原因**: 域名 `dashscope.aliyuncs.com` 不在合约白名单

**待解决**: 使用多签流程添加域名到白名单

---

## 调试命令

### 查看 Notary 日志
```bash
ssh -i "D:/Download/For_Agent.pem" ubuntu@101.33.252.78 \
  "tail -50 /home/ubuntu/tlsn-lib/notary.log"
```

### 查看 IS6200-Rust 日志
```bash
ssh -i "D:/Download/For_Agent.pem" ubuntu@101.33.252.78 \
  "tail -50 /home/ubuntu/IS6200-Rust/target/debug/is6200-rust"
```

### 测试 DashScope API (curl)
```bash
curl -s -X POST 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' \
  -H 'Authorization: Bearer sk-...' \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen-plus","messages":[{"role":"user","content":"你好"}]}'
```

---

## 代码位置

### 核心文件
- `IS6200-Rust/src/tlsn_ai.rs` - TLSN 客户端实现
- `IS6200-Rust/src/submit_content.rs` - 提交内容流程

### 参考文件
- `IS6200-Rust/tlsn-attestation/dist_attestation_client.rs` - 官方示例
- `IS6200-Rust/tlsn-attestation/dist_notary.rs` - Notary 实现

---

## 后续接续指南

1. SSH 连接: `ssh -i "D:/Download/For_Agent.pem" ubuntu@101.33.252.78`
2. 检查 Notary: `ps aux | grep dist_notary`
3. 如未运行，启动: `cd /home/ubuntu/tlsn-lib && cargo run --example dist_notary &`
4. 运行: `cd /home/ubuntu/IS6200-Rust && cargo run -- --submit "测试"`

---

*创建: 2026-03-28*
*更新: 2026-03-28*