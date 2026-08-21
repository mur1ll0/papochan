import * as Ably from 'ably';

export function getAblyRestClient(): Ably.Rest {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey || apiKey.includes('mock-ably-key')) {
    // In local dev without Ably key, configure with fallback
    return new Ably.Rest({ key: apiKey || 'mock-app-id.mock-key:mock-secret' });
  }
  return new Ably.Rest({ key: apiKey });
}

export async function createAblyTokenRequest(
  clientId: string,
  roomCode: string
): Promise<Ably.TokenRequest> {
  const ably = getAblyRestClient();
  const tokenParams: Ably.TokenParams = {
    clientId,
    capability: {
      [`ghost:room:${roomCode}`]: ['publish', 'subscribe', 'presence'],
    },
    ttl: 3600 * 1000, // 1 hour token
  };

  return await ably.auth.createTokenRequest(tokenParams);
}
