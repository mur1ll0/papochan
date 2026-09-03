import { getApiEndpoint } from '@/lib/api';

/**
 * ICE server resolution shared by every RTCPeerConnection in the mesh.
 *
 * STUN alone only discovers host and server-reflexive candidates. Peers behind
 * symmetric NAT or CGNAT (mobile data, corporate Wi-Fi, many residential ISPs)
 * never manage to form a direct path, so without a TURN relay both the media
 * tracks and the DataChannel silently fail while server-relayed signaling
 * (chat, knock/approval) keeps working perfectly.
 */

const DEFAULT_STUN_URLS: string[] = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
];

/**
 * Free shared TURN relay used when nothing else is configured, so the app works
 * out of the box. It is a public best-effort service with no capacity or uptime
 * guarantee: point TURN_URLS + TURN_SECRET at your own relay before carrying
 * production traffic (see deploy/coturn/).
 */
const FALLBACK_TURN_URLS: string[] = [
  'turn:openrelay.metered.ca:80',
  'turn:openrelay.metered.ca:443',
  'turn:openrelay.metered.ca:443?transport=tcp',
];
const FALLBACK_TURN_USERNAME = 'openrelayproject';
const FALLBACK_TURN_CREDENTIAL = 'openrelayproject';

/** Refresh this long before the credential actually expires. */
const CREDENTIAL_REFRESH_MARGIN_MS = 60_000;
/** How long to trust a fallback/static result before asking again. */
const STATIC_CACHE_MS = 5 * 60_000;

let cachedServers: { servers: RTCIceServer[]; expiresAtMs: number } | null = null;

function splitList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildStunServers(): RTCIceServer[] {
  const stunUrls = splitList(process.env.NEXT_PUBLIC_STUN_SERVERS);
  return [{ urls: stunUrls.length ? stunUrls : DEFAULT_STUN_URLS }];
}

export function buildFallbackTurnServer(): RTCIceServer {
  return {
    urls: FALLBACK_TURN_URLS,
    username: FALLBACK_TURN_USERNAME,
    credential: FALLBACK_TURN_CREDENTIAL,
  };
}

/**
 * Legacy client-side TURN credentials. Anything prefixed NEXT_PUBLIC_ is inlined
 * into the browser bundle, so these are readable by every visitor: they exist as
 * an escape hatch for a relay that this deployment does not front, not as the
 * recommended path. Prefer TURN_SECRET + /api/turn-credentials.
 */
function buildStaticTurnServer(): RTCIceServer | null {
  const urls = splitList(process.env.NEXT_PUBLIC_TURN_SERVERS);
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (!urls.length) return null;

  if (!username || !credential) {
    console.warn(
      '[ICE] NEXT_PUBLIC_TURN_SERVERS is set without username/credential. ' +
        'A turn: URL missing either one makes the RTCPeerConnection constructor throw, ' +
        'so it was ignored.'
    );
    return null;
  }

  return { urls, username, credential };
}

/**
 * Synchronous ICE configuration built purely from environment variables. Used as
 * the default when no resolved configuration was handed in, and as the fallback
 * whenever the credential endpoint cannot be reached.
 */
export function buildIceServers(): RTCIceServer[] {
  return [
    ...buildStunServers(),
    buildStaticTurnServer() ?? buildFallbackTurnServer(),
  ];
}

/**
 * Resolves the full ICE configuration, asking the server to mint short-lived
 * TURN credentials. Falls back to the static/public relay on any failure so a
 * credential outage degrades connectivity instead of breaking every call.
 */
export async function resolveIceServers(clientId?: string): Promise<RTCIceServer[]> {
  if (cachedServers && Date.now() < cachedServers.expiresAtMs) {
    return cachedServers.servers;
  }

  const stun = buildStunServers();

  // An explicitly configured static relay wins: it means the operator wired a
  // relay this deployment does not front.
  const staticTurn = buildStaticTurnServer();
  if (staticTurn) {
    const servers = [...stun, staticTurn];
    cachedServers = { servers, expiresAtMs: Date.now() + STATIC_CACHE_MS };
    return servers;
  }

  try {
    const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
    const res = await fetch(getApiEndpoint(`/api/turn-credentials${query}`), {
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();

      if (Array.isArray(data?.iceServers) && data.iceServers.length) {
        const servers = sanitizeIceServers([...stun, ...data.iceServers]);
        const lifetimeMs =
          typeof data.ttl === 'number' && data.ttl > 0
            ? Math.max(CREDENTIAL_REFRESH_MARGIN_MS, data.ttl * 1000 - CREDENTIAL_REFRESH_MARGIN_MS)
            : STATIC_CACHE_MS;

        cachedServers = { servers, expiresAtMs: Date.now() + lifetimeMs };
        console.log(`[ICE] Using ${data.source ?? 'configured'} TURN credentials.`);
        return servers;
      }

      if (data?.reason) {
        console.warn(`[ICE] No dedicated TURN relay configured: ${data.reason}`);
      }
    }
  } catch (err) {
    console.warn('[ICE] TURN credential request failed, using fallback relay:', err);
  }

  const servers = [...stun, buildFallbackTurnServer()];
  cachedServers = { servers, expiresAtMs: Date.now() + STATIC_CACHE_MS };
  return servers;
}

/** Drops the cached credentials, forcing the next resolve to re-fetch. */
export function invalidateIceServerCache(): void {
  cachedServers = null;
}

/**
 * Drops entries that would make the RTCPeerConnection constructor throw, so a
 * misconfigured environment variable degrades connectivity instead of taking
 * the whole call down.
 */
export function sanitizeIceServers(servers: RTCIceServer[] | undefined): RTCIceServer[] {
  if (!servers?.length) return buildIceServers();

  const safe = servers.filter((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const needsCredentials = urls.some((url) => /^turns?:/i.test(url || ''));
    if (!needsCredentials) return urls.some(Boolean);
    return Boolean(server.username && server.credential);
  });

  return safe.length ? safe : buildIceServers();
}
