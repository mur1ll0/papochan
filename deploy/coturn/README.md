# TURN relay for PapoChan (coturn)

The relay is only used when a direct peer-to-peer path cannot be formed — symmetric
NAT, CGNAT (most mobile carriers), or a firewall that blocks UDP. It forwards
DTLS-SRTP packets it cannot decrypt, so PapoChan's zero-knowledge property is
unaffected: the relay sees opaque bytes and metadata, never media or messages.

Credentials are minted per session by `/api/turn-credentials` and expire, so the
shared secret stays on the server. Never put a relay password in a
`NEXT_PUBLIC_*` variable — those are inlined into the browser bundle.

---

## 1. Get a host

Requirements: **a real public IPv4** (a machine behind NAT cannot be a relay),
plus outbound and inbound UDP.

| Option | Notes |
| :--- | :--- |
| Oracle Cloud "Always Free" | Free ARM VM with a public IP and a large monthly egress allowance — the best zero-cost option. Verify current terms. |
| Hetzner / DigitalOcean / Vultr | ~US$4–6/month, simpler networking. |
| Contabo | Cheap, generous bandwidth. |

The VM is not the real cost — **bandwidth is**. A relayed 1:1 video call runs
around 1.3 GB/hour; 60 FPS screen sharing is considerably more. That is exactly
why the relay is a fallback and not the default path.

## 2. Open the firewall

Both in the OS firewall and in the cloud provider's security group:

| Port | Protocol | Purpose |
| :--- | :--- | :--- |
| 3478 | UDP + TCP | STUN/TURN |
| 5349 | UDP + TCP | STUN/TURN over TLS |
| 49160–49200 | UDP | Relay allocations (must match `min-port`/`max-port`) |

## 3. Certificate (recommended)

`turns:` on a TLS port is what gets through networks that allow only HTTPS.

```bash
sudo certbot certonly --standalone -d turn.seudominio.com
mkdir -p certs
sudo cp /etc/letsencrypt/live/turn.seudominio.com/fullchain.pem certs/
sudo cp /etc/letsencrypt/live/turn.seudominio.com/privkey.pem  certs/
sudo chown -R $USER:$USER certs
```

Renewal replaces those files, so add a deploy hook that copies them again and
runs `docker compose restart coturn`.

Testing without a domain? Comment out the `cert` / `pkey` lines in
`turnserver.conf` and the `./certs` volume in `docker-compose.yml`.

## 4. Generate the secret

```bash
openssl rand -hex 32
```

Keep it. It goes in two places and they must match byte for byte: `static-auth-secret`
in `turnserver.conf`, and `TURN_SECRET` in the Vercel environment.

## 5. Configure and start

Edit `turnserver.conf` and replace:

- `REPLACE_ME_PUBLIC_IP` — the VM's public IPv4. On Oracle Cloud / AWS / GCP, where
  the public address is NAT-mapped onto a private NIC, use `external-ip=PUBLIC/PRIVATE`
  (e.g. `203.0.113.10/10.0.0.5`). Getting this wrong is the single most common
  reason a relay gathers no candidates.
- `REPLACE_ME_LONG_RANDOM_SECRET` — the secret from step 4.
- `REPLACE_ME_DOMAIN` — your relay hostname.

```bash
cd deploy/coturn
docker compose up -d
docker compose logs -f coturn
```

## 6. Verify before wiring it up

```bash
node deploy/coturn/mint-test-credential.mjs <seu-secret>
```

Take the printed pair to [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/):
add `turn:turn.seudominio.com:3478`, paste username and credential, then
**Gather candidates**.

- A row of type **`relay`** → the relay works.
- Only `host` / `srflx` → it does not. Check `external-ip`, the relay port range,
  and the security group.

---

## 7. Configure Vercel

**Project → Settings → Environment Variables.** Add three, all **without** the
`NEXT_PUBLIC_` prefix so they stay server-side, applied to Production, Preview
and Development:

| Name | Value | Sensitive |
| :--- | :--- | :--- |
| `TURN_SECRET` | the secret from step 4 | yes |
| `TURN_URLS` | `turn:turn.seudominio.com:3478,turn:turn.seudominio.com:3478?transport=tcp,turns:turn.seudominio.com:5349?transport=tcp` | no |
| `TURN_TTL_SECONDS` | `14400` (optional; default 4 h, clamped to 5 min–24 h) | no |

Listing UDP first, then TCP, then TLS lets ICE prefer the cheapest transport and
fall back only when the network forces it.

Then:

1. Leave `NEXT_PUBLIC_TURN_SERVERS`, `NEXT_PUBLIC_TURN_USERNAME` and
   `NEXT_PUBLIC_TURN_CREDENTIAL` **empty or deleted**. If set, they take priority
   and defeat the whole ephemeral-credential design.
2. **Redeploy.** Vercel binds environment variables at deploy time — saving a
   variable does not affect the running deployment.

### Confirm it took effect

```
https://papochan.vercel.app/api/turn-credentials
```

Expected:

```json
{
  "iceServers": [{ "urls": ["turn:..."], "username": "1735689600:...", "credential": "..." }],
  "source": "ephemeral",
  "ttl": 14400,
  "expiresAt": 1735689600
}
```

`"source": "fallback"` means the variables did not reach the deployment — the
`reason` field says which one is missing. In the browser console during a call you
should see `[ICE] Using ephemeral TURN credentials.`

## Relay without the REST API?

For a managed provider that only issues fixed credentials, set `TURN_URLS` plus
`TURN_STATIC_USERNAME` and `TURN_STATIC_CREDENTIAL` (still server-side, no
`NEXT_PUBLIC_`). The route passes them through and reports `"source": "static"`.
