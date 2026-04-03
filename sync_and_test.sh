#!/bin/bash
# 同步文件到云服务器并运行测试

set -e

echo "===== 同步文件到云服务器 ====="

# 定义服务器信息
SERVER_IP="101.33.252.78"
SSH_KEY="D:/Download/For_Agent.pem"
REMOTE_DIR="/home/ubuntu/IS6200-Rust"

# 检查文件是否存在
if [ ! -f "$SSH_KEY" ]; then
    echo "错误: SSH 密钥文件不存在: $SSH_KEY"
    exit 1
fi

echo "1. 同步更新的文件到服务器..."

# 同步 diagnose_ecdsa.rs
scp -i "$SSH_KEY" src/diagnose_ecdsa.rs "ubuntu@$SERVER_IP:$REMOTE_DIR/src/"
if [ $? -eq 0 ]; then
    echo "   ✅ diagnose_ecdsa.rs 同步成功"
else
    echo "   ❌ diagnose_ecdsa.rs 同步失败"
    exit 1
fi

echo ""
echo "2. 在云服务器上编译..."
ssh -i "$SSH_KEY" "ubuntu@$SERVER_IP" "cd $REMOTE_DIR && export PATH=\$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:\$PATH && cargo build --release 2>&1"

if [ $? -eq 0 ]; then
    echo "   ✅ 编译成功"
else
    echo "   ❌ 编译失败"
    exit 1
fi

echo ""
echo "3. 运行诊断测试..."
ssh -i "$SSH_KEY" "ubuntu@$SERVER_IP" "cd $REMOTE_DIR && export PATH=\$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:\$PATH && cargo run --release -- --diagnose '测试ECDSA诊断' 2>&1"

echo ""
echo "===== 完成 ====="
