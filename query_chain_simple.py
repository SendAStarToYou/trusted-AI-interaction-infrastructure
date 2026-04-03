#!/usr/bin/env python3
"""
链上内容查询脚本 (简化版)
使用直接RPC调用，无需web3.py
"""

import json
import sys
import urllib.request
import urllib.error

# 配置
CONTRACT_ADDRESS = "0x47db5ccac67fc66c7258b803525c76fe176698d6"
RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com"

def rpc_call(method, params=None):
    """发送RPC请求"""
    if params is None:
        params = []

    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    }

    data = json.dumps(payload).encode('utf-8')
    headers = {'Content-Type': 'application/json'}

    req = urllib.request.Request(RPC_URL, data=data, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            if 'error' in result:
                raise Exception(f"RPC错误: {result['error']}")
            return result['result']
    except urllib.error.URLError as e:
        raise Exception(f"连接错误: {e}")


def decode_uint256(hex_str):
    """解码uint256"""
    return int(hex_str, 16)


def decode_string(hex_str):
    """解码字符串"""
    # 简化处理，实际ABI解码更复杂
    return f"[编码数据: {hex_str[:40]}...]"


def query_total_count():
    """查询总记录数"""
    # getTotalContentCount() selector: 0x2d6a31e3
    call_data = "0x2d6a31e3"

    result = rpc_call("eth_call", [{
        "to": CONTRACT_ADDRESS,
        "data": call_data
    }, "latest"])

    count = decode_uint256(result)
    return count


def query_domain_whitelisted(domain):
    """查询域名白名单状态"""
    # isDomainWhitelisted(string) selector + 编码参数
    import hashlib

    # 计算selector
    signature = "isDomainWhitelisted(string)"
    selector = hashlib.sha3_256(signature.encode()).hexdigest()[:8]

    # 编码字符串参数 (简化)
    encoded = encode_string_param(domain)
    call_data = f"0x{selector}{encoded}"

    try:
        result = rpc_call("eth_call", [{
            "to": CONTRACT_ADDRESS,
            "data": call_data
        }, "latest"])
        return result.endswith('1')
    except:
        return None


def encode_string_param(s):
    """编码字符串参数 (简化实现)"""
    # 偏移量 (32字节)
    offset = "0000000000000000000000000000000000000000000000000000000000000020"
    # 长度 (32字节)
    length_hex = format(len(s), '064x')
    # 数据 (填充到32字节倍数)
    data = s.encode('utf-8').hex()
    padding = (64 - len(data) % 64) % 64
    data_padded = data + '0' * padding

    return offset + length_hex + data_padded


def main():
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║       TLSN 内容验证合约 - 链上查询工具                   ║")
    print(f"║  合约: {CONTRACT_ADDRESS[:30]}...               ║")
    print("╚═══════════════════════════════════════════════════════════╝")

    try:
        print("\n🔗 连接到 Sepolia 网络...")
        block_number = rpc_call("eth_blockNumber", [])
        print(f"✅ 当前区块: {decode_uint256(block_number)}")

        print("\n📊 查询合约状态...")

        # 查询总记录数
        total = query_total_count()
        print(f"\n   链上内容总记录数: {total}")

        # 查询域名白名单
        domain = "dashscope.aliyuncs.com"
        is_whitelisted = query_domain_whitelisted(domain)
        if is_whitelisted is not None:
            print(f"   域名 '{domain}': {'✅ 已白名单' if is_whitelisted else '❌ 未白名单'}")

        # 显示最近交易
        print("\n📋 最近上链内容:")
        print("=" * 70)
        print("   提示: 由于ABI解码复杂，完整内容记录请使用Etherscan查看")
        print(f"   https://sepolia.etherscan.io/address/{CONTRACT_ADDRESS}")

        print("\n📝 或使用Rust程序查看详细记录:")
        print("   cargo run --release")
        print("   选择菜单: 🔍 验证已有 IPFS 内容")

    except Exception as e:
        print(f"\n❌ 查询失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
