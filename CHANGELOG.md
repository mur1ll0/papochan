# Changelog

## 2.0.0

Breaking. **Every device must hard-refresh after this deploys**, and the Android
app must be reinstalled from the new release.

### Breaking

- **Forged signaling is now rejected.** Signature verification used to log a
  warning and process the envelope anyway, and nothing bound the signing key to
  the sender — so a room code was enough to forge an approval and admit yourself,
  or inject an offer and take over a negotiation. Envelopes are now dropped
  unless the signature verifies *and* the key matches the one that sender used
  before. Clients on an older bundle sign over a different canonical form and
  will be rejected rather than tolerated, hence the hard refresh.
- **Room entry requires an explicit approval.** Only the room creator enters
  unannounced. Host election is no longer trusted to admit anyone: it is
  server-derived state and was wrong on cold serverless instances, which let
  guests walk straight past the waiting room.

### Fixed

- Peer-to-peer media never connected. Replies sent while the signaling transport
  was still connecting went to an unconnected placeholder and were silently
  dropped, leaving the offerer stuck in `have-local-offer` forever.
- Duplicate `RTCPeerConnection`s were built for the same peer when discovery and
  an offer arrived in the same batch, and then fought each other with competing
  ICE candidates.
- Offers and answers were signed over an empty payload, because the canonical
  serialiser ignored `toJSON()` and `RTCSessionDescription` exposes its fields as
  prototype getters. Signature checks could never pass on the messages that
  matter most.
- Switching microphone or camera killed the outgoing stream for everyone else:
  the new track was never pushed onto the senders, which kept transmitting an
  ended track and a closed `AudioContext`.
- Remote audio played through two elements at once, so nothing could turn a
  participant down.
- Voices sounded robotic: capture ran the browser's noise suppression and gain
  control *and* the app's own chain over the same signal.
- Direct calls never worked — the Ably token did not grant the device its own
  inbox, so call invites were never delivered.
- The Copy button shared a URL still carrying `?host=1`, handing whoever received
  it ownership of the room.
- Android had no camera or microphone: the generated manifest never declared the
  permissions, so the WebView could not grant `getUserMedia`. **This is why 2.0.0
  is a major bump — the fix is compiled into the APK and cannot arrive over the
  web.**

### Added

- TURN relay support with short-lived HMAC credentials minted server-side, plus a
  self-hosting walkthrough in `deploy/coturn/`.
- RNNoise in the neural suppression mode, replacing a filter bank that was never
  neural despite the name.
- Per-participant volume control (right click, or long press on touch), covering
  camera and screen share separately.
- Participants panel: save someone from the call to your contacts, or ring a
  contact into the room you are already in.
- Development signaling is namespaced away from production, so the two can never
  share a room even with the same code. See `docs/environments.md`.
- `docs/security.md` — what is protected, and the known limits.
- `npm run test:mesh` — 34 regression checks over negotiation, admission,
  signing, ICE and environment isolation.

### Removed

- `sendRenegotiate` and its envelope type, implemented across all four signaling
  classes and never called once.
- `DEFAULT_ICE_SERVERS`, `invalidateIceServerCache`, `getRawUserStream`,
  `getProcessedStream` — no callers.
