// Distributed TLSN Attestation Client
// Unified example that can connect to any HTTPS server and get attestation
//
// Usage:
//   # Connect to Alibaba Cloud Dashscope (default)
//   cargo run --example dist_attestation_client
//
//   # Connect to httpbin.org
//   cargo run --example dist_attestation_client -- --server-host httpbin.org --server-port 443 --path /get
//
//   # Connect to local server-fixture
//   cargo run --example dist_attestation_client -- --server-host 127.0.0.1 --server-port 3000 --cert-mode test
//
//   # With API key for services that require it
//   DASHSCOPE_API_KEY=your-key cargo run --example dist_attestation_client

use std::env;
use std::error::Error;
use std::time::Instant;
use anyhow::Result;
use clap::Parser;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncReadCompatExt;
use tokio_util::compat::FuturesAsyncReadCompatExt;
use http_body_util::{BodyExt, Empty};
use hyper::{body::Bytes, Method, Request};
use hyper_util::rt::TokioIo;

use tlsn::{
    attestation::{
        request::{Request as AttestationRequest, RequestConfig},
        Attestation, CryptoProvider,
    },
    config::prover::ProverConfig,
    config::prove::ProveConfig,
    config::tls_commit::{TlsCommitConfig, mpc::{MpcTlsConfig, NetworkSetting}},
    config::tls::TlsClientConfig,
    connection::ServerName,
    webpki::{CertificateDer, RootCertStore},
    Session,
};

const NOTARY_PORT: u16 = 7040;
const ATTESTATION_PORT: u16 = 7041;

#[derive(Parser, Debug)]
struct Args {
    /// Notary server host
    #[clap(long, default_value = "127.0.0.1")]
    notary_host: String,

    /// Notary server port
    #[clap(long, default_value_t = NOTARY_PORT)]
    notary_port: u16,

    /// Target server host (e.g., dashscope.aliyuncs.com, httpbin.org)
    #[clap(long, default_value = "dashscope.aliyuncs.com")]
    server_host: String,

    /// Target server port
    #[clap(long, default_value_t = 443)]
    server_port: u16,

    /// Server name for TLS SNI (defaults to server_host if not specified)
    #[clap(long, default_value = "")]
    server_name: String,

    /// HTTP path (e.g., /api/v1/models, /get)
    #[clap(long, default_value = "/api/v1/models")]
    path: String,

    /// HTTP method
    #[clap(long, default_value = "GET")]
    method: String,

    /// Certificate mode: "mozilla" for real HTTPS, "test" for server-fixture
    #[clap(long, default_value = "mozilla")]
    cert_mode: String,

    /// Max data to send (bytes)
    #[clap(long, default_value_t = 8192)]
    max_sent_data: usize,

    /// Max data to receive (bytes)
    #[clap(long, default_value_t = 131072)]
    max_recv_data: usize,

    /// Custom HTTP headers (key:value, comma separated)
    #[clap(long, default_value = "")]
    headers: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    let start = Instant::now();
    let notary_addr = format!("{}:{}", args.notary_host, args.notary_port);

    println!("=== Distributed TLSN Attestation Client ===");
    println!("Notary: {}", notary_addr);
    println!("Target: {}:{}{}", args.server_host, args.server_port, args.path);
    println!("Cert Mode: {}\n", args.cert_mode);

    // Connect to notary via TCP
    let stream = TcpStream::connect(&notary_addr).await?;
    println!("✅ [{}ms] Connected to Notary (TLSN)", start.elapsed().as_millis());

    // Create TLSN Session
    let session = Session::new(stream.compat());
    let (driver, mut handle) = session.split();
    let driver_task = tokio::spawn(driver);

    // Create Prover configuration
    let prover_config = ProverConfig::builder().build()?;

    // Build TLS Commit configuration - optimized for external network
    let tls_config = TlsCommitConfig::builder()
        .protocol(MpcTlsConfig::builder()
            .max_sent_data(args.max_sent_data)
            .max_recv_data(args.max_recv_data)
            .network(NetworkSetting::Bandwidth)
            .build()?)
        .build()?;
    println!("✅ [{}ms] Prover config created", start.elapsed().as_millis());

    // Create Prover and commit
    let prover = handle.new_prover(prover_config)?
        .commit(tls_config).await?;
    println!("✅ [{}ms] Prover committed with notary", start.elapsed().as_millis());

    // Connect to target server
    let target_addr = format!("{}:{}", args.server_host, args.server_port);
    println!("🔌 [{}ms] Connecting to {}...", start.elapsed().as_millis(), target_addr);
    let client_socket = TcpStream::connect(&target_addr).await?;
    println!("✅ [{}ms] Connected to target server", start.elapsed().as_millis());

    // Setup root certificate store based on mode
    let root_store = if args.cert_mode == "test" {
        RootCertStore {
            roots: vec![CertificateDer(tlsn_server_fixture_certs::CA_CERT_DER.to_vec())],
        }
    } else {
        RootCertStore::mozilla()
    };
    println!("✅ [{}ms] Using {} root certificates", start.elapsed().as_millis(), args.cert_mode);

    // Bind prover to target connection
    // Use server_name if provided, otherwise use server_host
    let tls_server_name = if args.server_name.is_empty() {
        args.server_host.clone()
    } else {
        args.server_name.clone()
    };
    let tls_server_name_for_req = tls_server_name.clone();
    let (tls_connection, prover_fut) = prover.connect(
        TlsClientConfig::builder()
            .server_name(ServerName::Dns(tls_server_name.clone().try_into()?))
            .root_store(root_store)
            .build()?,
        client_socket.compat(),
    ).await?;
    println!("✅ [{}ms] TLS connection established", start.elapsed().as_millis());

    // Spawn the prover task to run in background
    let prover_task = tokio::spawn(prover_fut);

    // Wrap TLS connection for use with hyper (exact copy from task7_dashscope.rs)
    let tls_io = TokioIo::new(tls_connection.compat());

    // Create HTTP/1.1 client
    let (mut sender, conn) = hyper::client::conn::http1::handshake(tls_io).await?;
    println!("✅ [{}ms] HTTP client handshake done", start.elapsed().as_millis());

    // Spawn connection task
    tokio::spawn(conn);

    // Build HTTP request
    let method = match args.method.to_uppercase().as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PUT" => Method::PUT,
        "DELETE" => Method::DELETE,
        _ => Method::GET,
    };

    let mut req_builder = Request::builder()
        .uri(&args.path)
        .method(method)
        .header("Host", &tls_server_name_for_req)
        .header("Accept", "application/json");

    // Add API key header if DASHSCOPE_API_KEY is set
    if let Ok(api_key) = env::var("DASHSCOPE_API_KEY") {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", api_key));
        println!("🔑 Using DASHSCOPE_API_KEY");
    }

    // Add custom headers
    if !args.headers.is_empty() {
        for header in args.headers.split(',') {
            if let Some((key, value)) = header.split_once(':') {
                req_builder = req_builder.header(key.trim(), value.trim());
            }
        }
    }

    // Add Connection: close for servers that need it
    req_builder = req_builder.header("Connection", "close");

    let req: Request<Empty<Bytes>> = req_builder.body(Empty::<Bytes>::new())?;

    println!("📤 [{}ms] Sending {} {}...", start.elapsed().as_millis(), args.method, args.path);

    // Add timeout for the request
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        sender.send_request(req)
    ).await??;

    println!("✅ [{}ms] Response received: {}", start.elapsed().as_millis(), response.status());

    // Read response body
    let body = response.collect().await?;
    let body_bytes = body.to_bytes();
    println!("✅ Response body: {} bytes", body_bytes.len());

    // Print response preview
    if let Ok(text) = String::from_utf8(body_bytes.to_vec()) {
        let preview_len = text.len().min(500);
        println!("\nResponse preview:\n{}", &text[..preview_len]);
        if text.len() > 500 {
            println!("... (truncated)");
        }
    }

    // Wait for prover to finish
    let mut prover = prover_task.await??;
    println!("✅ [{}ms] Prover task completed", start.elapsed().as_millis());

    // Build attestation request
    println!("\n📝 Building attestation request...");

    let request_config = RequestConfig::builder().build()?;
    let prove_config = ProveConfig::builder(prover.transcript()).build()?;

    let prover_output = prover.prove(&prove_config).await?;

    let transcript = prover.transcript().clone();
    let tls_transcript = prover.tls_transcript().clone();
    let transcript_commitments = prover_output.transcript_commitments;
    let transcript_secrets = prover_output.transcript_secrets;

    prover.close().await?;

    let mut req_builder = AttestationRequest::builder(&request_config);
    req_builder
        .server_name(ServerName::Dns(tls_server_name_for_req.try_into()?))
        .handshake_data(tlsn::connection::HandshakeData {
            certs: tls_transcript.server_cert_chain().unwrap().to_vec(),
            sig: tls_transcript.server_signature().unwrap().clone(),
            binding: tls_transcript.certificate_binding().clone(),
        })
        .transcript(transcript)
        .transcript_commitments(transcript_secrets, transcript_commitments);

    let (request, _secrets) = req_builder.build(&CryptoProvider::default())?;
    println!("✅ [{}ms] Attestation request built", start.elapsed().as_millis());

    // Send attestation request to notary
    let att_addr = format!("{}:{}", args.notary_host, ATTESTATION_PORT);
    let mut att_stream = TcpStream::connect(&att_addr).await?;
    println!("✅ [{}ms] Connected to Notary (Attestation port)", start.elapsed().as_millis());

    let encoded = bincode::serialize(&request)?;
    let len = (encoded.len() as u32).to_be_bytes();
    att_stream.write_all(&len).await?;
    att_stream.write_all(&encoded).await?;
    println!("✅ [{}ms] Sent attestation request ({} bytes)", start.elapsed().as_millis(), encoded.len());

    // Receive attestation response
    let mut len_buf = [0u8; 4];
    att_stream.read_exact(&mut len_buf).await?;
    let len = u32::from_be_bytes(len_buf) as usize;

    if len == 0 {
        return Err(anyhow::anyhow!("Empty attestation response").into());
    }

    let mut response_buf = vec![0u8; len];
    att_stream.read_exact(&mut response_buf).await?;

    let attestation: Attestation = bincode::deserialize(&response_buf)?;
    println!("✅ [{}ms] Received attestation response ({} bytes)", start.elapsed().as_millis(), len);

    // Validate attestation
    let provider = CryptoProvider::default();
    request.validate(&attestation, &provider)?;
    println!("✅ [{}ms] Attestation validated successfully!", start.elapsed().as_millis());

    // Save attestation to file
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let safe_host = args.server_host.replace('.', "_");
    let att_path = format!("attestation_{}_{}.bin", safe_host, timestamp);
    tokio::fs::write(&att_path, bincode::serialize(&attestation)?).await?;
    println!("✅ Attestation saved to {}", att_path);

    // Save request for third-party verification
    let req_path = format!("attestation_request_{}_{}.bin", safe_host, timestamp);
    tokio::fs::write(&req_path, bincode::serialize(&request)?).await?;
    println!("✅ Attestation request saved to {} (needed for third-party verification)", req_path);

    // Clean up
    handle.close();
    driver_task.await??;

    println!("\n=== Attestation Complete! (Total: {}ms) ===", start.elapsed().as_millis());
    Ok(())
}