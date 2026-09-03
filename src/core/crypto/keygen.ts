import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

export interface DeviceKeyPair {
  // Ed25519 for digital signatures & presence authentication
  signKeyPair: nacl.SignKeyPair;
  // X25519 for Diffie-Hellman (ECDH) key exchange
  boxKeyPair: nacl.BoxKeyPair;
}

export interface SerializedPublicKeys {
  publicKeyEd: string; // Base64 encoded Ed25519 public key
  publicKeyDh: string; // Base64 encoded X25519 public key
}

export interface SerializedIdentity {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'browser';
  userId: string;
  username: string;
  publicKeyEd: string;
  publicKeyDh: string;
  privateKeyEd: string; // Base64 encoded Ed25519 secret key
  privateKeyDh: string; // Base64 encoded X25519 secret key
  createdAt: number;
}

/**
 * Generates fresh cryptographic keypairs locally on the device:
 * - Ed25519 for identity signing and signaling authenticity.
 * - X25519 for Diffie-Hellman key exchange.
 */
export function generateDeviceKeyPair(): DeviceKeyPair {
  const signKeyPair = nacl.sign.keyPair();
  const boxKeyPair = nacl.box.keyPair();

  return {
    signKeyPair,
    boxKeyPair,
  };
}

/**
 * Exports public keys into standard Base64 representation for synchronization with signaling and DB.
 */
export function exportPublicKeys(keyPair: DeviceKeyPair): SerializedPublicKeys {
  return {
    publicKeyEd: encodeBase64(keyPair.signKeyPair.publicKey),
    publicKeyDh: encodeBase64(keyPair.boxKeyPair.publicKey),
  };
}

/**
 * Imports public keys from Base64 representation.
 */
export function importPublicKey(base64Key: string): Uint8Array {
  return decodeBase64(base64Key);
}

/**
 * Deterministically serializes any JavaScript object or value into a canonical JSON string
 * with alphabetically sorted keys. Ensures cryptographic signature verification never fails
 * due to JSON object key reordering during network transit or database JSONB storage.
 */
export function canonicalJsonStringify(obj: any): string {
  // Match JSON.stringify's treatment of undefined, because the verifier only
  // ever sees the payload after a JSON round trip: undefined array entries
  // become null, and undefined object properties disappear entirely. Keeping
  // them here made the signer and the verifier hash different strings, so every
  // signature check failed.
  if (obj === undefined) {
    return 'null';
  }
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  // Honour toJSON() the way JSON.stringify does. Native WebRTC objects such as
  // RTCSessionDescription expose type/sdp as prototype getters, so Object.keys()
  // sees nothing: without this, every offer and answer was signed over an empty
  // {} while the receiver verified the real serialized payload, and the Ed25519
  // check could never pass on the messages that matter most.
  if (typeof obj.toJSON === 'function') {
    return canonicalJsonStringify(obj.toJSON());
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined && typeof obj[key] !== 'function')
    .sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Signs a payload with the device's private Ed25519 key.
 */
export function signPayload(message: string | Uint8Array, secretKeyEd: Uint8Array): string {
  const bytes = typeof message === 'string' ? decodeUTF8(message) : message;
  const signature = nacl.sign.detached(bytes, secretKeyEd);
  return encodeBase64(signature);
}

/**
 * Verifies a signature against the sender's public Ed25519 key.
 */
export function verifySignature(
  message: string | Uint8Array,
  signatureBase64: string,
  publicKeyEd: Uint8Array | string
): boolean {
  try {
    const bytes = typeof message === 'string' ? decodeUTF8(message) : message;
    const sigBytes = decodeBase64(signatureBase64);
    const pubBytes = typeof publicKeyEd === 'string' ? decodeBase64(publicKeyEd) : publicKeyEd;
    return nacl.sign.detached.verify(bytes, sigBytes, pubBytes);
  } catch {
    return false;
  }
}

/**
 * Derives a human-verifiable 12-digit Safety Number (Fingerprint)
 * computed by hashing both parties' public keys with SHA-256.
 * Formatted as: XXXX - XXXX - XXXX
 */
export async function deriveSafetyNumber(
  localPubKeyDh: string | Uint8Array,
  remotePubKeyDh: string | Uint8Array
): Promise<string> {
  const localBytes = typeof localPubKeyDh === 'string' ? decodeBase64(localPubKeyDh) : localPubKeyDh;
  const remoteBytes = typeof remotePubKeyDh === 'string' ? decodeBase64(remotePubKeyDh) : remotePubKeyDh;

  // Lexicographical ordering ensures both peers compute the exact same safety number
  const comparison = compareByteArrays(localBytes, remoteBytes);
  const combined = new Uint8Array(localBytes.length + remoteBytes.length);

  if (comparison <= 0) {
    combined.set(localBytes, 0);
    combined.set(remoteBytes, localBytes.length);
  } else {
    combined.set(remoteBytes, 0);
    combined.set(localBytes, remoteBytes.length);
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined as BufferSource);
  const hashBytes = new Uint8Array(hashBuffer);

  // Extract digits for safety number (3 groups of 4 digits)
  let numStr = '';
  for (let i = 0; i < 6; i++) {
    const value = (hashBytes[i * 2] << 8) | hashBytes[i * 2 + 1];
    numStr += (value % 10000).toString().padStart(4, '0');
  }

  return `${numStr.slice(0, 4)} - ${numStr.slice(4, 8)} - ${numStr.slice(8, 12)}`;
}

/**
 * Computes a short visual Hex Fingerprint of any public key (e.g., "7A:B4:9C:...").
 */
export async function computeKeyFingerprint(pubKey: string | Uint8Array): Promise<string> {
  const bytes = typeof pubKey === 'string' ? decodeBase64(pubKey) : pubKey;
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  const hashBytes = new Uint8Array(hashBuffer);
  const hex = Array.from(hashBytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
  return hex;
}

function compareByteArrays(a: Uint8Array, b: Uint8Array): number {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}
