// Distributed Notary Server for TLSN Attestation
// Listens on TCP and handles prover connections with full attestation protocol
// Uses shared state between ports 7040 (TLSN) and 7041 (Attestation)
//
// Protocol Flow:
// 1. Prover connects to Notary via TCP 7040 for TLSN session
// 2. Notary runs MPC-TLS verification with prover
// 3. Notary stores MPC-TLS data in shared state
// 4. Prover connects to target server, sends HTTP request
// 5. Prover sends AttestationRequest via TCP 7041
// 6. Notary reads MPC-TLS data from shared state
// 7. Notary builds and signs attestation, returns via TCP 7041
// 8. Prover validates and saves attestation

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Result;
use clap::Parser;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio_util::compat::TokioAsyncReadCompatExt;

use tlsn::{
    attestation::{
        request::Request as AttestationRequest,
        signing::Secp256k1Signer,
        Attestation, AttestationConfig, CryptoProvider,
    },
    config::verifier::VerifierConfig,
    connection::{ConnectionInfo, TranscriptLength},
    transcript::{ContentType, TranscriptCommitment},
    verifier::VerifierOutput,
    webpki::{CertificateDer, RootCertStore},
    Session,
};

const NOTARY_PORT: u16 = 7040;
const ATTESTATION_PORT: u16 = 7041;

// Shared state to store MPC-TLS data between ports
#[derive(Clone)]
struct NotaryState {
    mpc_data: Arc<Mutex<Option<MpcData>>>,
}

#[derive(Clone)]
struct MpcData {
    tls_transcript: tlsn::transcript::TlsTranscript,
    transcript_commitments: Vec<TranscriptCommitment>,
    sent_len: u32,
    recv_len: u32,
}

#[derive(Parser, Debug)]
struct Args {
    #[clap(short, long, default_value_t = NOTARY_PORT)]
    port: u16,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Initialize shared state
    let state = NotaryState {
        mpc_data: Arc::new(Mutex::new(None)),
    };
    let state_clone = state.clone();

    let att_addr = SocketAddr::from(([0, 0, 0, 0], ATTESTATION_PORT));
    let att_listener = TcpListener::bind(att_addr).await?;
    println!("=== Distributed Notary Server ===");
    println!("Attestation data listening on port {}", ATTESTATION_PORT);

    // Spawn attestation handler with shared state
    let att_state = state.clone();
    tokio::spawn(async move {
        loop {
            match att_listener.accept().await {
                Ok((stream, client_addr)) => {
                    println!("[Attestation] New connection from: {}", client_addr);
                    let att_state = att_state.clone();
                    tokio::spawn(handle_attestation(stream, att_state));
                }
                Err(e) => {
                    eprintln!("Attestation listener error: {}", e);
                }
            }
        }
    });

    // Main TLSN session listener
    let addr = SocketAddr::from(([0, 0, 0, 0], args.port));
    let listener = TcpListener::bind(addr).await?;
    println!("TLSN Session listening on port {}", args.port);
    println!("Waiting for prover connections...\n");

    loop {
        let (stream, client_addr) = listener.accept().await?;
        println!("[TLSN] New connection from: {}", client_addr);
        let state = state_clone.clone();

        tokio::spawn(async move {
            if let Err(e) = handle_prover(stream, state).await {
                eprintln!("TLSN Error: {}", e);
            }
        });
    }
}

async fn handle_attestation(mut stream: TcpStream, state: NotaryState) -> Result<()> {
    // Receive attestation request length (4 bytes)
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).await?;
    let len = u32::from_be_bytes(len_buf) as usize;

    // Receive attestation request data
    let mut request_buf = vec![0u8; len];
    stream.read_exact(&mut request_buf).await?;
    let request: AttestationRequest = bincode::deserialize(&request_buf)?;

    println!("    [Attestation] Received attestation request ({} bytes)", len);

    // Get MPC-TLS data from shared state
    let mpc_data = {
        let guard = state.mpc_data.lock().await;
        guard.clone()
    };

    match mpc_data {
        Some(data) => {
            println!("    [Attestation] Got MPC-TLS data from shared state");

            // Create signing key
            let signing_key = k256::ecdsa::SigningKey::from_bytes(&[1u8; 32].into())?;
            let signer = Box::new(Secp256k1Signer::new(&signing_key.to_bytes())?);
            let mut provider = CryptoProvider::default();
            provider.signer.set_signer(signer);

            let att_config = AttestationConfig::builder()
                .supported_signature_algs(Vec::from_iter(provider.signer.supported_algs()))
                .build()?;

            // Build attestation with MPC-TLS data
            let mut builder = Attestation::builder(&att_config).accept_request(request)?;

            builder
                .connection_info(ConnectionInfo {
                    time: data.tls_transcript.time(),
                    version: (*data.tls_transcript.version()),
                    transcript_length: TranscriptLength {
                        sent: data.sent_len,
                        received: data.recv_len,
                    },
                })
                .server_ephemeral_key(data.tls_transcript.server_ephemeral_key().clone())
                .transcript_commitments(data.transcript_commitments.clone());

            let attestation = builder.build(&provider)?;

            // Serialize attestation
            let encoded = bincode::serialize(&attestation)?;
            let len = (encoded.len() as u32).to_be_bytes();

            // Send attestation response
            stream.write_all(&len).await?;
            stream.write_all(&encoded).await?;
            stream.flush().await?;

            // Wait to ensure data is sent
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            println!("    [Attestation] Sent attestation ({} bytes)", encoded.len());
        }
        None => {
            println!("    [Attestation] WARNING: No MPC-TLS data available!");
            // Send empty response
            let empty: Vec<u8> = vec![];
            let len = (0u32).to_be_bytes();
            stream.write_all(&len).await?;
            stream.flush().await?;
        }
    }

    Ok(())
}

async fn handle_prover(stream: TcpStream, state: NotaryState) -> Result<()> {
    // Create TLSN session with prover
    let stream = stream.compat();
    let session = Session::new(stream);
    let (driver, mut handle) = session.split();
    let driver_task = tokio::spawn(driver);

    println!("    [1] Creating TLSN session...");

    // Create verifier config
    let verifier_config = VerifierConfig::builder()
        .root_store(RootCertStore {
            roots: vec![CertificateDer(
                tlsn_server_fixture_certs::CA_CERT_DER.to_vec(),
            )],
        })
        .build()
        .unwrap();

    println!("    [2] Running MPC-TLS verification...");

    // Create verifier and run MPC-TLS
    let verifier = handle
        .new_verifier(verifier_config)?
        .commit()
        .await?
        .accept()
        .await?
        .run()
        .await?;

    let (
        VerifierOutput {
            transcript_commitments,
            ..
        },
        verifier,
    ) = verifier.verify().await?.accept().await?;

    let tls_transcript = verifier.tls_transcript().clone();
    verifier.close().await?;

    let sent_len = tls_transcript
        .sent()
        .iter()
        .filter_map(|record| {
            if let ContentType::ApplicationData = record.typ {
                Some(record.ciphertext.len())
            } else {
                None
            }
        })
        .sum::<usize>() as u32;

    let recv_len = tls_transcript
        .recv()
        .iter()
        .filter_map(|record| {
            if let ContentType::ApplicationData = record.typ {
                Some(record.ciphertext.len())
            } else {
                None
            }
        })
        .sum::<usize>() as u32;

    println!("    [3] MPC-TLS verified: sent={} bytes, recv={} bytes", sent_len, recv_len);

    // Store MPC-TLS data in shared state
    let mpc_data = MpcData {
        tls_transcript: tls_transcript.clone(),
        transcript_commitments: transcript_commitments.clone(),
        sent_len,
        recv_len,
    };

    {
        let mut guard = state.mpc_data.lock().await;
        *guard = Some(mpc_data);
    }
    println!("    [4] MPC-TLS data stored in shared state");

    // Wait for prover to send attestation request on port 7041
    println!("    [5] Waiting for attestation request on port {}...", ATTESTATION_PORT);

    // Close the TLSN session
    handle.close();
    driver_task.await??;

    println!("    [6] TLSN session closed");
    Ok(())
}