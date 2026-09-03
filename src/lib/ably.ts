import * as Ably from 'ably';

export function getAblyRestClient(): Ably.Rest {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey || apiKey.includes('mock-ably-key')) {
    // In local dev without Ably key, configure with fallback
    return new Ably.Rest({ key: apiKey || 'mock-app-id.mock-key:mock-secret' });
  }
  return new Ably.Rest({ key: apiKey });
}

/** Channel names are built from these, so anything else is refused outright. */
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;

export async function createAblyTokenRequest(
  clientId: string,
  roomCode: string,
  deviceId?: string
): Promise<Ably.TokenRequest> {
  const ably = getAblyRestClient();

  const capability: Record<string, string[]> = {};

  // A wildcard or colon slipped into these would widen the grant, so only plain
  // identifiers ever reach a capability key.
  if (SAFE_SEGMENT.test(roomCode)) {
    capability[`ghost:room:${roomCode}`] = ['publish', 'subscribe', 'presence'];
  }

  if (deviceId && SAFE_SEGMENT.test(deviceId)) {
    // Own inbox: receive incoming call invites.
    capability[`inbox:${deviceId}`] = ['publish', 'subscribe', 'presence'];
    // Any other inbox: publish only, which is what ringing someone means. You
    // can place a call but never eavesdrop on someone else's invites, and the
    // invite itself is Ed25519-signed so the callee verifies who is calling.
    capability['inbox:*'] = ['publish'];
  }

  const tokenParams: Ably.TokenParams = {
    clientId,
    capability: capability as Ably.TokenParams['capability'],
    ttl: 3600 * 1000, // 1 hour token
  };

  return await ably.auth.createTokenRequest(tokenParams);
}
