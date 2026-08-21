import { NextRequest, NextResponse } from 'next/server';
import { createAblyTokenRequest } from '@/lib/ably';

export async function GET(req: NextRequest) {
  return handleAuth(req);
}

export async function POST(req: NextRequest) {
  return handleAuth(req);
}

async function handleAuth(req: NextRequest) {
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
      // In local dev without live Ably key, provide a clear structured response or mock token
      return NextResponse.json({
        token: `mock_jwt_token_${Date.now()}`,
        clientId,
        roomCode,
        keyName: 'mock-key',
        issuedAt: Date.now(),
        expires: Date.now() + 3600000,
        capability: JSON.stringify({ [`ghost:room:${roomCode}`]: ['*'] }),
      });
    }

    const tokenRequest = await createAblyTokenRequest(clientId, roomCode);
    return NextResponse.json(tokenRequest);
  } catch (error: any) {
    console.error('[API:signaling-token] Error generating token request:', error);
    return NextResponse.json(
      { error: 'Failed to issue signaling token', details: error?.message },
      { status: 500 }
    );
  }
}
