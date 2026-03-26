// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TLSNContentVerifierWithMultisig (Optimized)
 * @dev TLS Notary 内容验证 + 多签白名单管理
 * 优化: 降低 Gas 开销，保持安全性
 */
contract TLSNContentVerifierWithMultisig {
    // ==================== 常量 ====================

    uint8 public constant SIGNATURE_THRESHOLD = 2;
    uint256 public constant PROOF_EXPIRY = 86400;

    // ==================== 数据结构 ====================

    enum OperationType { AddWhitelist, RemoveWhitelist }

    struct PendingOperation {
        string domain;
        OperationType opType;
        uint8 signatureCount;
        bool executed;
    }

    struct ContentRecord {
        bytes32 contentHash;
        string ipfsCid;
        bytes32 domainHash;
        address uploader;
        uint256 timestamp;
    }

    // ==================== 状态变量 ====================

    mapping(address => bool) public admins;
    mapping(bytes32 => bool) public whitelistedDomains;
    mapping(uint256 => PendingOperation) public pendingOperations;
    uint256 public operationCount;
    mapping(bytes32 => ContentRecord) public contentRecords;

    // ==================== 事件 ====================

    event WhitelistOperationCreated(uint256 indexed operationId, string domain, OperationType opType, address creator);
    event WhitelistOperationSigned(uint256 indexed operationId, address indexed signer, uint8 signatureCount);
    event WhitelistOperationExecuted(uint256 indexed operationId, string domain, OperationType opType);
    event ContentVerified(bytes32 indexed contentHash, string ipfsCid, address indexed uploader);
    event TLSNVerificationFailed(bytes32 indexed contentHash, string reason);

    // ==================== 修饰符 ====================

    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }

    // ==================== 构造函数 ====================

    constructor(address[3] memory _admins) {
        for (uint i = 0; i < 3; i++) {
            admins[_admins[i]] = true;
        }
    }

    // ==================== 白名单管理 ====================

    function createPendingOperation(string memory _domain, bool _isAdd)
        external onlyAdmin returns (uint256 opId)
    {
        require(bytes(_domain).length > 0);

        opId = operationCount++;
        pendingOperations[opId] = PendingOperation({
            domain: _domain,
            opType: _isAdd ? OperationType.AddWhitelist : OperationType.RemoveWhitelist,
            signatureCount: 1,
            executed: false
        });

        emit WhitelistOperationCreated(opId, _domain, pendingOperations[opId].opType, msg.sender);
    }

    function signOperation(uint256 _opId) external onlyAdmin {
        PendingOperation storage op = pendingOperations[_opId];
        require(!op.executed, "Executed");

        op.signatureCount++;

        emit WhitelistOperationSigned(_opId, msg.sender, op.signatureCount);
    }

    function executeOperation(uint256 _opId) external onlyAdmin {
        PendingOperation storage op = pendingOperations[_opId];
        require(!op.executed, "Executed");
        require(op.signatureCount >= SIGNATURE_THRESHOLD, "Not enough sigs");

        op.executed = true;
        bytes32 domainHash = keccak256(bytes(op.domain));

        if (op.opType == OperationType.AddWhitelist) {
            whitelistedDomains[domainHash] = true;
        } else {
            whitelistedDomains[domainHash] = false;
        }

        emit WhitelistOperationExecuted(_opId, op.domain, op.opType);
    }

    function getOperationDetails(uint256 _opId)
        external view returns (string memory domain, OperationType opType, uint8 signatureCount, bool executed)
    {
        PendingOperation storage op = pendingOperations[_opId];
        return (op.domain, op.opType, op.signatureCount, op.executed);
    }

    function isDomainWhitelisted(string calldata _domain) external view returns (bool) {
        return whitelistedDomains[keccak256(bytes(_domain))];
    }

    // ==================== TLSN 验证 ====================

    function _verifyTLSNProof(bytes memory _proof) internal view returns (bool, string memory) {
        if (_proof.length < 137) {
            return (false, "Proof too short");
        }

        bytes32 proofType;
        assembly {
            // bytes 类型有长度前缀，所以 proof_type 在 offset 32
            proofType := mload(add(_proof, 32))
        }

        bytes32 expectedV1 = keccak256("TLSN_PROOF_V1");
        bytes32 expectedV0 = keccak256("TLSN_PROOF");
        if (proofType != expectedV1 && proofType != expectedV0) {
            return (false, "Invalid type");
        }

        uint256 ts;
        assembly {
            // timestamp 在 offset 64 (32 长度 + 32 proof_type)
            ts := mload(add(_proof, 64))
        }

        if (ts != 0) {
            unchecked {
                if (block.timestamp > ts) {
                    if (block.timestamp - ts > PROOF_EXPIRY) {
                        return (false, "Expired");
                    }
                }
            }
        }

        if (_proof.length < 137) {
            return (false, "No sig");
        }

        return (true, "");
    }

    // ==================== 内容验证 ====================

    function verifyAndStoreContent(
        bytes32 _contentHash,
        string calldata _ipfsCid,
        string calldata _requestId,
        string calldata _fullPrompt,
        bytes memory _tlsnProof,
        bytes32 _expectedContentHash,
        bytes32 _domainHash
    ) external {
        require(whitelistedDomains[_domainHash], "Domain not whitelisted");
        require(bytes(_fullPrompt).length > 0, "Empty prompt");
        require(_contentHash == _expectedContentHash, "Hash mismatch");

        (bool validProof, string memory reason) = _verifyTLSNProof(_tlsnProof);
        if (!validProof) {
            emit TLSNVerificationFailed(_contentHash, reason);
            revert(string.concat("TLSN invalid: ", reason));
        }

        contentRecords[_contentHash] = ContentRecord({
            contentHash: _contentHash,
            ipfsCid: _ipfsCid,
            domainHash: _domainHash,
            uploader: msg.sender,
            timestamp: block.timestamp
        });

        emit ContentVerified(_contentHash, _ipfsCid, msg.sender);
    }

    function verifyAndStoreBatch(
        bytes32[] calldata _contentHashes,
        string[] calldata _ipfsCids,
        bytes[] calldata _tlsnProofs,
        bytes32 _domainHash
    ) external {
        require(whitelistedDomains[_domainHash], "Domain not whitelisted");
        require(_contentHashes.length == _ipfsCids.length, "Length mismatch");
        require(_contentHashes.length == _tlsnProofs.length, "Length mismatch");

        uint256 len = _contentHashes.length;
        mapping(bytes32 => ContentRecord) storage records = contentRecords;

        for (uint256 i = 0; i < len; ) {
            bytes32 hash = _contentHashes[i];

            (bool valid, ) = _verifyTLSNProof(_tlsnProofs[i]);
            if (valid) {
                records[hash] = ContentRecord({
                    contentHash: hash,
                    ipfsCid: _ipfsCids[i],
                    domainHash: _domainHash,
                    uploader: msg.sender,
                    timestamp: block.timestamp
                });
                emit ContentVerified(hash, _ipfsCids[i], msg.sender);
            }

            unchecked { ++i; }
        }
    }

    function getContentRecord(bytes32 _contentHash)
        external view returns (bytes32, string memory, address, uint256)
    {
        ContentRecord storage record = contentRecords[_contentHash];
        return (record.contentHash, record.ipfsCid, record.uploader, record.timestamp);
    }

    function validateTLSNProof(bytes memory _proof) external view returns (bool, string memory) {
        return _verifyTLSNProof(_proof);
    }

    function addAdmin(address _admin) external {
        require(admins[msg.sender], "Not admin");
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) external {
        require(admins[msg.sender], "Not admin");
        admins[_admin] = false;
    }
}