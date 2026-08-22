import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRoomCode } from '@/lib/utils';
import { checkRateLimit } from '@/lib/rateLimit';

const hasDatabase = !!process.env.POSTGRES_PRISMA_URL || !!process.env.DATABASE_URL;

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 20, 60000, 'rooms-create');
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many room creation requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.reset) } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedCode = body.roomCode?.toUpperCase().trim();
    const roomCode = requestedCode || generateRoomCode();

    if (!hasDatabase) {
      // In-memory P2P mode (no database required)
      return NextResponse.json({
        success: true,
        roomCode,
        offlineMode: true,
      });
    }

    try {
      // Race database query with 600ms timeout to avoid UI lag if database is offline
      const room = await Promise.race([
        db.room.upsert({
          where: { roomCode },
          update: {},
          create: { roomCode },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database connection timeout')), 600)
        ),
      ]);

      return NextResponse.json({
        success: true,
        roomCode: room.roomCode,
        createdAt: room.createdAt,
      });
    } catch {
      // In-memory fallback
      return NextResponse.json({
        success: true,
        roomCode,
        offlineMode: true,
      });
    }
  } catch (error: any) {
    console.error('[API:rooms] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 60, 60000, 'rooms-get');
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.reset) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code')?.toUpperCase().trim();

  if (!code) {
    return NextResponse.json({ error: 'Room code is required' }, { status: 400 });
  }

  if (!hasDatabase) {
    // In-memory P2P mode
    return NextResponse.json({
      exists: true,
      roomCode: code,
      offlineMode: true,
    });
  }

  try {
    const room = await Promise.race([
      db.room.findUnique({
        where: { roomCode: code },
        include: {
          members: {
            include: {
              user: {
                include: {
                  devices: true,
                },
              },
            },
          },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database connection timeout')), 600)
      ),
    ]);

    if (!room) {
      return NextResponse.json({ exists: false, roomCode: code });
    }

    return NextResponse.json({
      exists: true,
      roomCode: room.roomCode,
      createdAt: room.createdAt,
      memberCount: room.members.length,
    });
  } catch {
    // In decentralized / zero-knowledge fallback mode, allow room entry
    return NextResponse.json({
      exists: true,
      roomCode: code,
      offlineMode: true,
    });
  }
}
