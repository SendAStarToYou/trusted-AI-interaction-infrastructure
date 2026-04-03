#!/bin/bash
cd /home/ubuntu/IS6200-Rust
export PATH=$HOME/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin:$PATH
cargo run -- --submit "Test" 2>&1 | tee /tmp/proof_output.txt