#!/usr/bin/env node
/**
 * Regression test for the mesh negotiation layer.
 *
 * Reproduces the exact signaling batch that used to build duplicate
 * RTCPeerConnections: `onPeerJoined` and `onOffer` for the same remote node
 * dispatched in one tick, while WebCrypto key derivation is still pending.
 *
 * Runs against the real MeshManager/PeerConnection sources, compiled on the fly
 * with tsc, under minimal stubs for the browser media APIs.
 *
 *   node scripts/test-mesh-negotiation.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(import.meta.dirname, '..');

// ---------------------------------------------------------------------------
// Browser API stubs
// ---------------------------------------------------------------------------

let constructedPeerConnections = 0;
const createdDataChannels = [];

class FakeMediaStream {
  constructor(tracks = []) {
    this.id = `stream-${Math.random().toString(36).slice(2, 9)}`;
    this._tracks = [...tracks];
  }
  getTracks() {
    return [...this._tracks];
  }
  getAudioTracks() {
    return this._tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }
  addTrack(track) {
    if (!this._tracks.includes(track)) this._tracks.push(track);
  }
  removeTrack(track) {
    this._tracks = this._tracks.filter((t) => t !== track);
  }
  addEventListener() {}
  removeEventListener() {}
}

class FakeRTCPeerConnection {
  constructor(config) {
    constructedPeerConnections += 1;
    this.config = config;
    this.signalingState = 'stable';
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.localDescription = null;
    this.remoteDescription = null;
    this._senders = [];
  }
  createDataChannel(label) {
    const channel = {
      label,
      readyState: 'connecting',
      binaryType: 'arraybuffer',
      close() {
        this.readyState = 'closed';
      },
      send() {},
    };
    createdDataChannels.push(channel);
    return channel;
  }
  addTrack(track, stream) {
    const sender = { track, stream, replaceTrack: async (t) => { sender.track = t; } };
    this._senders.push(sender);
    return sender;
  }
  removeTrack(sender) {
    sender.track = null;
  }
  getSenders() {
    return [...this._senders];
  }
  async setLocalDescription(description) {
    if (description?.type === 'rollback') {
      this.signalingState = 'stable';
      this.localDescription = null;
      return;
    }
    const type = this.signalingState === 'have-remote-offer' ? 'answer' : 'offer';
    this.localDescription = { type, sdp: `sdp-${type}` };
    this.signalingState = type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(description) {
    this.remoteDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate() {}
  async getStats() {
    return new Map();
  }
  restartIce() {}
  close() {
    this.connectionState = 'closed';
  }
}

globalThis.MediaStream = FakeMediaStream;
globalThis.RTCPeerConnection = FakeRTCPeerConnection;
globalThis.window = globalThis;
// navigator is a getter-only global in Node; MediaEngine only touches it lazily.

// ---------------------------------------------------------------------------
// Compile the sources under test
// ---------------------------------------------------------------------------

// Emitted inside node_modules so bare specifiers (tweetnacl, ...) still resolve.
const outDir = mkdtempSync(join(ROOT, 'node_modules', '.papochan-mesh-'));

// A throwaway tsconfig: CommonJS output for interop with the CJS-only crypto
// deps, while keeping the project's "@/*" path alias.
const tsconfigPath = join(ROOT, 'tsconfig.meshtest.json');
writeFileSync(
  tsconfigPath,
  JSON.stringify({
    compilerOptions: {
      target: 'es2022',
      lib: ['es2022', 'dom'],
      module: 'commonjs',
      moduleResolution: 'node',
      esModuleInterop: true,
      skipLibCheck: true,
      strict: false,
      noEmit: false,
      outDir,
      rootDir: 'src',
      baseUrl: '.',
      paths: { '@/*': ['./src/*'] },
    },
    files: ['src/core/webrtc/MeshManager.ts', 'src/lib/turn.ts', 'src/core/crypto/keygen.ts'],
  })
);

try {
  execFileSync(
    process.execPath,
    [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', tsconfigPath],
    { cwd: ROOT, stdio: 'pipe' }
  );
} catch (err) {
  console.error(err.stdout?.toString() || err.message);
  rmSync(tsconfigPath, { force: true });
  process.exit(1);
} finally {
  rmSync(tsconfigPath, { force: true });
}

// CommonJS output keeps interop with the CJS-only crypto deps (tweetnacl-util).
writeFileSync(join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));

// tsc type-checks the "@/*" alias but emits it verbatim, so rewrite the aliased
// requires to point at the compiled tree.
const emittedRoot = outDir.split('\\').join('/');
function rewriteAliases(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      rewriteAliases(full);
    } else if (entry.endsWith('.js')) {
      const source = readFileSync(full, 'utf8');
      const patched = source.replace(/require\("@\/([^"]+)"\)/g, (_m, rest) => `require("${emittedRoot}/${rest}")`);
      if (patched !== source) writeFileSync(full, patched);
    }
  }
}
rewriteAliases(outDir);

// tsc derives rootDir from the inputs, so the emitted layout is not fixed.
function locate(dir, fileName) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const found = locate(full, fileName);
      if (found) return found;
    } else if (entry === fileName) {
      return full;
    }
  }
  return null;
}

const requireCompiled = createRequire(join(outDir, 'index.cjs'));
const { MeshManager } = requireCompiled(locate(outDir, 'MeshManager.js'));

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const requireRoot = createRequire(join(ROOT, 'index.cjs'));
const nacl = requireRoot('tweetnacl');
const { encodeBase64 } = requireRoot('tweetnacl-util');

function makeIdentity(userId, deviceId) {
  const dh = nacl.box.keyPair();
  const ed = nacl.sign.keyPair();
  return {
    meta: {
      deviceId,
      deviceName: deviceId,
      deviceType: 'desktop',
      userId,
      username: userId,
      publicKeyEd: encodeBase64(ed.publicKey),
      publicKeyDh: encodeBase64(dh.publicKey),
      capabilities: { hasAudio: true, hasVideo: true, hasScreenShare: false },
    },
    secretKeyDh: dh.secretKey,
    secretKeyEd: ed.secretKey,
  };
}

class StubSignaler {
  constructor() {
    this.events = {};
    this.sent = [];
  }
  setEventListeners(events) {
    this.events = { ...this.events, ...events };
  }
  async sendOffer(targetId, sdp) {
    this.sent.push({ type: 'offer', targetId, sdp });
  }
  async sendAnswer(targetId, sdp) {
    this.sent.push({ type: 'answer', targetId, sdp });
  }
  async sendCandidate(targetId, candidate) {
    this.sent.push({ type: 'candidate', targetId, candidate });
  }
  async sendStateUpdate() {}
  async sendChatMessage() {}
  async sendPresenceAnnounce() {}
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

// --- Test 1: concurrent discovery must yield exactly one PeerConnection ------
{
  constructedPeerConnections = 0;
  createdDataChannels.length = 0;

  const local = makeIdentity('user-local', 'device-a');
  const remote = makeIdentity('user-remote', 'device-b');
  const signaler = new StubSignaler();

  new MeshManager({
    localMeta: local.meta,
    localSecretKeyDh: local.secretKeyDh,
    localSecretKeyEd: local.secretKeyEd,
    signalingClient: signaler,
  });

  // One signaling batch: peer list entry + presence-announce + an offer, all
  // dispatched without awaiting - exactly how HttpSignaler.pollMessages and the
  // Ably presence/announce pair deliver them.
  const dispatched = [
    signaler.events.onPeerJoined(remote.meta),
    signaler.events.onPeerJoined(remote.meta),
    signaler.events.onOffer(
      `${remote.meta.userId}:${remote.meta.deviceId}`,
      { type: 'offer', sdp: 'remote-offer' },
      remote.meta
    ),
  ];
  await Promise.all(dispatched);

  check(
    'concurrent onPeerJoined + onOffer creates a single RTCPeerConnection',
    constructedPeerConnections === 1,
    `constructed=${constructedPeerConnections}`
  );

  const answers = signaler.sent.filter((m) => m.type === 'answer');
  check(
    'the remote offer is answered exactly once',
    answers.length === 1,
    `answers=${answers.length}`
  );

  check(
    'only the impolite side opens the DataChannel',
    createdDataChannels.length <= 1,
    `channels=${createdDataChannels.length}`
  );
}

// --- Test 2: ICE servers always carry a usable TURN relay --------------------
{
  const iceModule = requireCompiled(locate(outDir, 'iceServers.js'));
  const servers = iceModule.buildIceServers();
  const flat = servers.flatMap((s) => (Array.isArray(s.urls) ? s.urls : [s.urls]));
  const turnEntries = servers.filter((s) =>
    (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => /^turns?:/i.test(u))
  );

  check(
    'ICE config includes STUN candidates',
    flat.some((u) => u.startsWith('stun:')),
    `${flat.filter((u) => u.startsWith('stun:')).length} stun urls`
  );
  check(
    'ICE config includes a TURN relay',
    turnEntries.length >= 1,
    `${turnEntries.length} turn entries`
  );
  check(
    'every TURN entry carries username and credential',
    turnEntries.every((s) => s.username && s.credential),
    'constructor would throw otherwise'
  );

  // A misconfigured TURN entry must be dropped, not crash the call.
  const sanitized = iceModule.sanitizeIceServers([{ urls: 'turn:example.org:3478' }]);
  check(
    'credential-less TURN entries are filtered out',
    sanitized.every((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return !urls.some((u) => /^turns?:/i.test(u)) || (s.username && s.credential);
    }),
    'falls back to the safe default set'
  );
}

// --- Test 3: ephemeral TURN credentials match what coturn recomputes ---------
{
  const { mintTurnCredentials, sanitizeTurnIdentifier, parseTurnUrls } =
    requireCompiled(locate(outDir, 'turn.js'));
  const { createHmac } = await import('node:crypto');

  const secret = 'test-secret-do-not-use';
  const before = Math.floor(Date.now() / 1000);
  const minted = mintTurnCredentials(secret, 3600, 'user-1:device-2');

  const [expiryPart, identifierPart] = minted.username.split(':');

  check(
    'username is <unix expiry>:<identifier>',
    Number(expiryPart) >= before + 3600 && identifierPart === 'user-1-device-2',
    minted.username
  );

  // coturn verifies exactly this: base64(HMAC-SHA1(secret, username)).
  const expected = createHmac('sha1', secret).update(minted.username).digest('base64');
  check(
    'credential is base64(HMAC-SHA1(secret, username))',
    minted.credential === expected,
    'recomputed independently'
  );

  const other = mintTurnCredentials('a-different-secret', 3600, 'user-1:device-2');
  check(
    'a different secret yields a different credential',
    other.credential !== minted.credential,
    'HMAC is keyed'
  );

  check(
    'identifier is stripped of separator characters',
    !sanitizeTurnIdentifier('a:b/c d').includes(':'),
    sanitizeTurnIdentifier('a:b/c d')
  );

  check(
    'TURN_URLS parsing keeps only turn:/turns: entries',
    JSON.stringify(parseTurnUrls('turn:a:3478, https://nope, turns:b:5349')) ===
      JSON.stringify(['turn:a:3478', 'turns:b:5349']),
    JSON.stringify(parseTurnUrls('turn:a:3478, https://nope, turns:b:5349'))
  );
}

// --- Test 4: signaling signatures survive the wire ---------------------------
{
  const { canonicalJsonStringify, signPayload, verifySignature } =
    requireCompiled(locate(outDir, 'keygen.js'));

  const kp = requireRoot('tweetnacl').sign.keyPair();
  const publicKeyEd = encodeBase64(kp.publicKey);

  // Signs a payload, pushes it through a JSON round trip the way a signaling
  // transport does, and verifies it on the other side.
  const roundTrip = (type, payload) => {
    const timestamp = Date.now();
    const head = `${type}|sender|*|ROOM|${timestamp}|`;
    const signature = signPayload(head + canonicalJsonStringify(payload), kp.secretKey);
    const received = JSON.parse(JSON.stringify({ payload })).payload;
    return verifySignature(head + canonicalJsonStringify(received), signature, publicKeyEd);
  };

  check(
    'plain object payloads verify after a JSON round trip',
    roundTrip('knock', { userId: 'u', capabilities: { hasAudio: true } }),
    'presence, knock, chat'
  );

  check(
    'undefined properties do not break verification',
    roundTrip('device-state-update', { hasAudio: true, trackMap: { userVideoTrackId: undefined } }),
    'JSON.stringify drops them in transit'
  );

  // RTCSessionDescription exposes type/sdp as prototype getters and serializes
  // through toJSON(). Object.keys() sees nothing, so a canonicaliser that
  // ignores toJSON signs {} and can never match the verifier.
  class FakeSessionDescription {
    constructor(type, sdp) {
      Object.defineProperty(this, '_t', { value: type, enumerable: false });
      Object.defineProperty(this, '_s', { value: sdp, enumerable: false });
    }
    get type() { return this._t; }
    get sdp() { return this._s; }
    toJSON() { return { type: this._t, sdp: this._s }; }
  }

  const sdpObject = new FakeSessionDescription('answer', 'v=0\r\na=mid:0\r\n');
  check(
    'canonical form of an SDP object is not empty',
    canonicalJsonStringify(sdpObject) !== '{}',
    canonicalJsonStringify(sdpObject).slice(0, 48)
  );
  check(
    'offer/answer payloads verify after a JSON round trip',
    roundTrip('answer', { sdp: sdpObject }),
    'the messages an MITM would forge'
  );
}

rmSync(outDir, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
