import { NextRequest, NextResponse } from 'next/server';
import { createAblyTokenRequest } from '@/lib/ably';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  return handleAuth(req);
}

export async function POST(req: NextRequest) {
  return handleAuth(req);
}

async function handleAuth(req: NextRequest) {
  // Apply rate limiting: max 30 token requests per minute per IP
  const rateLimit = checkRateLimit(req, 30, 60000, 'signaling-token');
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please slow down.',
        retryAfter: rateLimit.reset,
      },
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
    const { searchParams } = new URL(req.url);
    let clientId = searchParams.get('clientId');
    let roomCode = searchParams.get('roomCode');

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        clientId = body.clientId || clientId;
        roomCode = body.roomCode || roomCode;
      } catch {
        // body might be empty in some GET/POST proxies
      }
    }

    if (!clientId) {
      clientId = `anon:${crypto.randomUUID()}`;
    }

    if (!roomCode) {
      roomCode = 'general';
    }

    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey || apiKey.includes('mock-ably-key') || apiKey === 'your-ably-api-key-here') {
      // Return clear fallback indicator so client instantly switches to zero-latency HTTP signaling
      return NextResponse.json({
        fallbackToHttp: true,
        hasAbly: false,
        clientId,
        roomCode,
      });
    }

    const tokenRequest = await createAblyTokenRequest(clientId, roomCode);
    return NextResponse.json({ ...tokenRequest, hasAbly: true });

  } catch (error: any) {
    console.error('[API:signaling-token] Error generating token request:', error);
    return NextResponse.json(
      { error: 'Failed to issue signaling token', details: error?.message },
      { status: 500 }
    );
  }
}
