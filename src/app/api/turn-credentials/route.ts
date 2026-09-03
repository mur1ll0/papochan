import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { mintTurnCredentials, parseTurnUrls } from '@/lib/turn';

// Node runtime: the credential is an HMAC computed with node:crypto, and the
// secret must never be inlined into an edge bundle.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_TTL_SECONDS = 4 * 60 * 60; // 4 hours: longer than any realistic call
const MIN_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

function resolveTtl(): number {
  const raw = parseInt(process.env.TURN_TTL_SECONDS || '', 10);
  if (!Number.isFinite(raw)) return DEFAULT_TTL_SECONDS;
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, raw));
}

/**
 * Issues short-lived TURN credentials for the browser.
 *
 * Returns TURN entries only - the client keeps its own STUN list and merges the
 * two. Three modes, in priority order:
 *
 *   ephemeral - TURN_SECRET + TURN_URLS are set: mint an HMAC credential.
 *   static    - TURN_STATIC_USERNAME/_CREDENTIAL are set: pass them through,
 *               for a relay that does not support the REST API.
 *   fallback  - nothing configured: the client falls back to the public relay
 *               and is told so, so it can warn instead of failing silently.
 */
export async function GET(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 60, 60000, 'turn-credentials');
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.reset),
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  }

  try {
    const turnUrls = parseTurnUrls(process.env.TURN_URLS);

    if (!turnUrls.length) {
      return NextResponse.json(
        {
          iceServers: [],
          source: 'fallback',
          reason: 'TURN_URLS is not configured on this deployment.',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const secret = process.env.TURN_SECRET;

    if (secret) {
      const { searchParams } = new URL(req.url);
      const ttl = resolveTtl();
      const { username, credential, expiresAt } = mintTurnCredentials(
        secret,
        ttl,
        searchParams.get('clientId')
      );

      return NextResponse.json(
        {
          iceServers: [{ urls: turnUrls, username, credential }],
          source: 'ephemeral',
          ttl,
          expiresAt,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const staticUsername = process.env.TURN_STATIC_USERNAME;
    const staticCredential = process.env.TURN_STATIC_CREDENTIAL;

    if (staticUsername && staticCredential) {
      return NextResponse.json(
        {
          iceServers: [
            { urls: turnUrls, username: staticUsername, credential: staticCredential },
          ],
          source: 'static',
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        iceServers: [],
        source: 'fallback',
        reason:
          'TURN_URLS is set but no credentials: provide TURN_SECRET, or TURN_STATIC_USERNAME + TURN_STATIC_CREDENTIAL.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    console.error('[API:turn-credentials] Error issuing credentials:', error);
    return NextResponse.json(
      { error: 'Failed to issue TURN credentials' },
      { status: 500 }
    );
  }
}
