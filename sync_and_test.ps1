# 同步文件到云服务器并运行测试 (PowerShell 版本)

$SERVER_IP = "101.33.252.78"
$SSH_KEY = "D:/Download/For_Agent.pem"
$REMOTE_DIR = "/home/ubuntu/IS6200-Rust"

Write-Host "===== 同步文件到云服务器 =====" -ForegroundColor Cyan

# 检查文件是否存在
if (-not (Test-Path $SSH_KEY)) {
    Write-Host "错误: SSH 密钥文件不存在: $SSH_KEY" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "1. 同步更新的文件到服务器..." -ForegroundColor Yellow

# 同步 diagnose_ecdsa.rs
$scpResult = scp -i $SSH_KEY src/diagnose_ecdsa.rs "ubuntu@${SERVER_IP}:${REMOTE_DIR}/src/" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ diagnose_ecdsa.rs 同步成功" -ForegroundColor Green
} else {
    Write-Host "   ❌ diagnose_ecdsa.rs 同步失败" -ForegroundColor Red
    Write-Host $scpResult
    exit 1
}

Write-Host ""
Write-Host "2. 在云服务器上编译..." -ForegroundColor Yellow
$compileResult = ssh -i $SSH_KEY "ubuntu@$SERVER_IP" "cd $REMOTE_DIR && export PATH=\`$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:\`$PATH && cargo build --release 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ 编译成功" -ForegroundColor Green
} else {
    Write-Host "   ❌ 编译失败" -ForegroundColor Red
    Write-Host $compileResult
    exit 1
}

Write-Host ""
Write-Host "3. 运行诊断测试..." -ForegroundColor Yellow
ssh -i $SSH_KEY "ubuntu@$SERVER_IP" "cd $REMOTE_DIR && export PATH=\`$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:\`$PATH && cargo run --release -- --diagnose '测试ECDSA诊断' 2>&1"

Write-Host ""
Write-Host "===== 完成 =====" -ForegroundColor Cyan
