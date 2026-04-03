#!/bin/bash
cd /home/ubuntu/IS6200-Rust
export PATH=$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:$PATH
cargo build 2>&1 | tail -3
cargo run -- --submit "Hello" 2>&1 | grep -E "(proof size|proof\[|✅.*验证)"