import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

export interface EncryptedPacket {
  iv: string; // Base64 96-bit (12 bytes) Initialization Vector
  ciphertext: string; // Base64 encrypted payload with appended authentication tag
  timestamp: number;
  senderDeviceId: string;
}

export interface EncryptedFileChunk {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  iv: string;
  data: string; // Base64 encrypted chunk bytes
  fileDigest: string; // SHA-256 integrity hash of entire original file
}

/**
 * Derives a 256-bit AES-GCM symmetric session key from local private X25519
 * and remote public X25519 keys via Diffie-Hellman + HKDF-SHA-256.
 */
export async function deriveSharedKey(
  localSecretKeyDh: Uint8Array | string,
  remotePublicKeyDh: Uint8Array | string,
  saltInfo: string = 'ghostprotocol-e2ee-v1'
): Promise<CryptoKey> {
  const localSecretBytes =
    typeof localSecretKeyDh === 'string' ? decodeBase64(localSecretKeyDh) : localSecretKeyDh;
  const remotePublicBytes =
    typeof remotePublicKeyDh === 'string' ? decodeBase64(remotePublicKeyDh) : remotePublicKeyDh;

  // 1. X25519 Diffie-Hellman scalar multiplication
  const rawSharedSecret = nacl.scalarMult(localSecretBytes, remotePublicBytes);

  // 2. Import raw shared secret as HKDF master key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawSharedSecret as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // 3. Derive 256-bit AES-GCM key using HKDF-SHA-256
  const enc = new TextEncoder();
  const info = enc.encode(saltInfo);
  const salt = enc.encode('ghostprotocol-zero-knowledge-salt');

  const sessionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      info: info as BufferSource,
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // Non-extractable for security
    ['encrypt', 'decrypt']
  );

  return sessionKey;
}

/**
 * Encrypts an arbitrary payload (string or object) with AES-256-GCM.
 * Generates a fresh cryptographically secure 12-byte IV for every message.
 */
export async function encryptPayload(
  payload: string | object,
  sessionKey: CryptoKey,
  senderDeviceId: string
): Promise<EncryptedPacket> {
  const plaintext = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const enc = new TextEncoder();
  const data = enc.encode(plaintext);

  // Generate 96-bit (12 bytes) random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-GCM (appends 128-bit authentication tag automatically)
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
    },
    sessionKey,
    data as BufferSource
  );

  return {
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(encryptedBuffer)),
    timestamp: Date.now(),
    senderDeviceId,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted packet using the session key.
 * Throws if authentication tag fails or data is corrupted/tampered.
 */
export async function decryptPayload<T = any>(
  packet: EncryptedPacket,
  sessionKey: CryptoKey
): Promise<T> {
  const iv = decodeBase64(packet.iv);
  const cipherBytes = decodeBase64(packet.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
    },
    sessionKey,
    cipherBytes as BufferSource
  );

  const dec = new TextDecoder();
  const decryptedText = dec.decode(decryptedBuffer);

  try {
    return JSON.parse(decryptedText) as T;
  } catch {
    return decryptedText as unknown as T;
  }
}

/**
 * Computes the SHA-256 digest of a full file for end-to-end integrity verification.
 */
export async function computeFileDigest(fileBuffer: ArrayBuffer): Promise<string> {
  const digestBuffer = await crypto.subtle.digest('SHA-256', fileBuffer as BufferSource);
  return Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypts a single chunk of a file stream.
 */
export async function encryptFileChunk(
  chunk: ArrayBuffer,
  fileId: string,
  chunkIndex: number,
  totalChunks: number,
  fileName: string,
  fileSize: number,
  mimeType: string,
  fileDigest: string,
  sessionKey: CryptoKey
): Promise<EncryptedFileChunk> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
    },
    sessionKey,
    chunk as BufferSource
  );

  return {
    fileId,
    chunkIndex,
    totalChunks,
    fileName,
    fileSize,
    mimeType,
    iv: encodeBase64(iv),
    data: encodeBase64(new Uint8Array(encryptedBuffer)),
    fileDigest,
  };
}

/**
 * Decrypts a received file chunk.
 */
export async function decryptFileChunk(
  chunk: EncryptedFileChunk,
  sessionKey: CryptoKey
): Promise<ArrayBuffer> {
  const iv = decodeBase64(chunk.iv);
  const cipherBytes = decodeBase64(chunk.data);

  return await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      tagLength: 128,
    },
    sessionKey,
    cipherBytes as BufferSource
  );
}
