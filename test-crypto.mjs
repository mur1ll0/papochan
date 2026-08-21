import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const { encodeBase64, decodeBase64, decodeUTF8 } = naclUtil;

async function runCryptoVerification() {
  console.log('--- 1. Testing Ed25519 Signature ---');
  const aliceSign = nacl.sign.keyPair();
  const message = 'ghostprotocol-signaling-test-12345';
  const msgBytes = decodeUTF8(message);
  const signature = nacl.sign.detached(msgBytes, aliceSign.secretKey);
  const isValid = nacl.sign.detached.verify(msgBytes, signature, aliceSign.publicKey);
  console.log('Ed25519 Signature Verified:', isValid);
  if (!isValid) throw new Error('Ed25519 verification failed');

  console.log('--- 2. Testing X25519 Diffie-Hellman Key Exchange ---');
  const aliceDh = nacl.box.keyPair();
  const bobDh = nacl.box.keyPair();

  // Shared secret computed from Alice and Bob
  const aliceSecret = nacl.scalarMult(aliceDh.secretKey, bobDh.publicKey);
  const bobSecret = nacl.scalarMult(bobDh.secretKey, aliceDh.publicKey);

  const matched = aliceSecret.every((val, i) => val === bobSecret[i]);
  console.log('X25519 Shared Secrets Match:', matched);
  if (!matched) throw new Error('X25519 shared secret mismatch');

  console.log('--- 3. Testing AES-256-GCM Web Crypto Derivation & Encryption ---');
  const baseKey = await crypto.subtle.importKey(
    'raw',
    aliceSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const enc = new TextEncoder();
  const sessionKeyAlice = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('ghostprotocol-zero-knowledge-salt'),
      info: enc.encode('ghostprotocol-e2ee-v1'),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const baseKeyBob = await crypto.subtle.importKey(
    'raw',
    bobSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const sessionKeyBob = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('ghostprotocol-zero-knowledge-salt'),
      info: enc.encode('ghostprotocol-e2ee-v1'),
    },
    baseKeyBob,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt with Alice
  const plaintext = 'Zero-Knowledge Multi-Device Co-Presence Payload';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    sessionKeyAlice,
    enc.encode(plaintext)
  );

  // Decrypt with Bob
  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    sessionKeyBob,
    ciphertext
  );

  const decryptedText = new TextDecoder().decode(decryptedBuf);
  console.log('Decrypted Text:', decryptedText);
  if (decryptedText !== plaintext) throw new Error('AES-GCM decryption failed');

  console.log('\n>>> ALL ZERO-KNOWLEDGE CRYPTOGRAPHIC INVARIANTS VERIFIED SUCCESSFULLY! <<<');
}

runCryptoVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
