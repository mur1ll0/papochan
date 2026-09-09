# Security model

What the app actually guarantees, how each guarantee is enforced, and where the
limits are. Written to be checked against the code, not to reassure.

## What is protected

**Media in transit.** Audio, video and screen share travel as DTLS-SRTP between
browsers. The signaling server routes the handshake and never holds the keys.

**Chat and files.** Encrypted with AES-256-GCM under a key derived per pair via
X25519 ECDH and HKDF-SHA256 (`src/core/crypto/cipher.ts`). Nothing is written to
a database; messages live in memory and are gone when the tab closes.

**Signaling authenticity.** Every envelope is signed with Ed25519 and verified on
arrival. Two checks run, and both must pass (`SignalingClient.isEnvelopeAuthentic`):

1. **The signature verifies** against the public key in the envelope.
2. **That key is the one this sender used before.** The signature alone proves
   nothing about identity: the envelope carries its own `publicKeyEd`, so anyone
   can mint a keypair, put someone else's `senderId` on the envelope and sign it
   with their own key — it verifies perfectly. Pinning the key to the sender on
   first contact is what turns a valid signature into proof of identity.

A failing envelope is **dropped**, not logged and processed. This matters because
a room code is all it takes to reach a room's channel: without enforcement,
anyone holding one could forge a `knock-approved` and admit themselves, or inject
an `offer` and take over the negotiation.

**Room entry.** Only the room creator (`?host=1`) enters unannounced. Everyone
else waits for an explicit approval, and an unapproved peer gets no
`RTCPeerConnection` at all — so the waiting room withholds audio, video and the
data channel rather than only hiding the UI. Host election is never trusted for
this: it is server-derived state, and on serverless it can be wrong.

**Room codes.** 9 characters from a 32-symbol alphabet via
`crypto.getRandomValues` — about 45 bits, ~3.5 x 10^13 combinations. Not
guessable at any practical rate.

**Relay credentials.** TURN credentials are minted per session by
`/api/turn-credentials` and expire. The shared secret stays on the server. Never
put a relay password in a `NEXT_PUBLIC_*` variable: those are inlined into the
browser bundle and readable by every visitor.

**Ably capability.** Tokens grant only this environment's channels, and only this
device's own inbox — plus publish-only on other inboxes, which is what ringing
someone means. You can place a call, never read someone else's invites.

## Known limits

**Trust on first use.** Key pinning is per session, learned on first contact.
A party positioned to intercept the very first envelope from a peer could pin
their own key. Safety Numbers exist for this: compare them out of band and an
interception becomes visible.

**Rate limiting is per instance.** `src/lib/rateLimit.ts` keeps counters in a
`Map`, and serverless functions do not share memory — each cold instance starts
at zero, so the published limits are far weaker in production than they look. A
real limiter needs a shared store.

**Signaling metadata is not private.** The server sees who is in which room, when
and from where. Only the contents are opaque to it.

**A relay sees traffic patterns.** When a call falls back to TURN the relay
forwards packets it cannot decrypt, but it does learn who talks to whom, for how
long and how much.

**The public fallback relay is shared.** With no TURN configured the app uses a
public best-effort relay. Fine for getting started, not for production — see
`deploy/coturn/README.md`.

**Everything trusts the served JavaScript.** Zero-knowledge here means the server
does not hold keys, not that a compromised deployment could not start collecting
them. Whoever controls the deployment controls the client.

## Rolling out signature enforcement

Enforcement is a breaking change for clients on an older build: their envelopes
were signed over a different canonical form and are now rejected rather than
tolerated. After deploying, every device should hard-refresh. A client that
cannot connect while others can is almost always a stale bundle.

## Platform limits worth knowing

**Screen sharing works only on desktop.** Neither Android nor iOS exposes
getDisplayMedia - to any browser, and not to the system WebView either - because
screen capture there goes through native MediaProjection / ReplayKit rather than
a web API. Mobile devices still *receive* and display a screen share normally;
they just cannot originate one. The button is disabled there rather than failing
when pressed.

## Reporting

Found something? Open an issue without the exploit details and ask for a private
channel first.
