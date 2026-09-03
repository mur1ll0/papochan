import { createHmac } from 'crypto';

export interface TurnCredentials {
  username: string;
  credential: string;
  ttl: number;
  expiresAt: number;
}

/**
 * Strips characters that would confuse the `<expiry>:<identifier>` username
 * layout, and caps the length so a hostile client cannot inflate the token.
 */
export function sanitizeTurnIdentifier(identifier: string | null | undefined): string {
  if (!identifier) return '';
  return identifier.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
}

/**
 * Mints a time-limited TURN credential using the TURN REST API convention that
 * coturn implements as `use-auth-secret`:
 *
 *   username   = <unix expiry timestamp>[:<identifier>]
 *   credential = base64( HMAC-SHA1( static-auth-secret, username ) )
 *
 * coturn recomputes the same HMAC from its own copy of the secret, so nothing
 * has to be provisioned per user. The secret never leaves the server: the
 * browser only ever receives a credential that stops working after `ttlSeconds`,
 * which is what keeps a `NEXT_PUBLIC_` variable from handing your relay
 * bandwidth to anyone who opens DevTools.
 */
export function mintTurnCredentials(
  secret: string,
  ttlSeconds: number,
  identifier?: string | null
): TurnCredentials {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const safeIdentifier = sanitizeTurnIdentifier(identifier);
  const username = safeIdentifier ? `${expiresAt}:${safeIdentifier}` : `${expiresAt}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');

  return { username, credential, ttl: ttlSeconds, expiresAt };
}

/**
 * Parses the comma-separated TURN_URLS environment variable.
 */
export function parseTurnUrls(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^turns?:/i.test(url));
}
