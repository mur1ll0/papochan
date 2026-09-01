import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import { db } from '@/lib/db';
import { getAblyRestClient } from '@/lib/ably';

// In-Memory Signaling Bus Cache with TTL
interface StoredSignal {
  id: string;
  roomCode: string;
  senderId: string;
  targetId?: string;
  envelope: any;
  timestamp: number;
}

interface RoomPeerState {
  clientId: string;
  meta: any;
  lastSeen: number;
  isHost: boolean;
}

interface RoomState {
  roomCode: string;
  hostId: string | null;
  createdAt: number;
  peers: Map<string, RoomPeerState>;
  messages: StoredSignal[];
}

// In-memory fallback / L1 cache
const roomsStore = new Map<string, RoomState>();

function getOrCreateMemoryRoom(roomCode: string): RoomState {
  const code = roomCode.toUpperCase();
  let room = roomsStore.get(code);
  if (!room) {
    room = {
      roomCode: code,
      hostId: null,
      createdAt: Date.now(),
      peers: new Map(),
      messages: [],
    };
    roomsStore.set(code, room);
  }
  return room;
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 1200, 60000, 'signaling-post');
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.reset) } }
    );
  }

  try {
    const body = await req.json();
    const { roomCode, envelope, action, meta, isHost } = body;

    if (!roomCode || (!envelope && !action)) {
      return NextResponse.json({ error: 'Missing roomCode or payload' }, { status: 400 });
    }

    const code = roomCode.toUpperCase();
    const now = Date.now();
    const memRoom = getOrCreateMemoryRoom(code);

    if (action === 'heartbeat' && meta) {
      const clientId = `${meta.userId}:${meta.deviceId}`;
      const peerId = `${code}:${clientId}`;

      // Update in-memory
      if (!memRoom.hostId || (isHost && !memRoom.peers.has(clientId))) {
        memRoom.hostId = clientId;
      }
      memRoom.peers.set(clientId, {
        clientId,
        meta,
        lastSeen: now,
        isHost: memRoom.hostId === clientId,
      });

      // Update PostgreSQL for Vercel multi-instance serverless sync
      try {
        await db.signalingPeer.upsert({
          where: { id: peerId },
          create: {
            id: peerId,
            roomCode: code,
            clientId,
            meta,
            isHost: isHost || memRoom.hostId === clientId,
            lastSeen: BigInt(now),
          },
          update: {
            meta,
            isHost: isHost || memRoom.hostId === clientId,
            lastSeen: BigInt(now),
          },
        });
      } catch (dbErr) {
        console.warn('[Signaling:POST] DB peer upsert fallback to memory:', dbErr);
      }

      return NextResponse.json({
        success: true,
        isHost: memRoom.hostId === clientId,
        hostId: memRoom.hostId,
        peersCount: memRoom.peers.size,
      });
    }

    if (action === 'leave' && meta) {
      const clientId = `${meta.userId}:${meta.deviceId}`;
      const peerId = `${code}:${clientId}`;

      memRoom.peers.delete(clientId);
      if (memRoom.hostId === clientId) {
        const nextPeer = Array.from(memRoom.peers.values())[0];
        memRoom.hostId = nextPeer ? nextPeer.clientId : null;
      }

      try {
        await db.signalingPeer.delete({ where: { id: peerId } }).catch(() => {});
      } catch {}

      return NextResponse.json({ success: true });
    }

    if (envelope) {
      const storedId = `${now}-${Math.random().toString(36).slice(2, 7)}`;
      const stored: StoredSignal = {
        id: storedId,
        roomCode: code,
        senderId: envelope.senderId,
        targetId: envelope.targetId,
        envelope,
        timestamp: now,
      };

      // Push to memory cache
      memRoom.messages.push(stored);
      if (memRoom.messages.length > 200) {
        memRoom.messages.shift();
      }

      // Persist to PostgreSQL for multi-instance Vercel delivery
      try {
        await db.signalingMessage.create({
          data: {
            id: storedId,
            roomCode: code,
            senderId: envelope.senderId,
            targetId: envelope.targetId || null,
            envelope: envelope as any,
            timestamp: BigInt(now),
          },
        });

        // Prune stale DB messages in background (> 90s)
        const cutoff = BigInt(now - 90000);
        db.signalingMessage
          .deleteMany({ where: { roomCode: code, timestamp: { lt: cutoff } } })
          .catch(() => {});
      } catch (dbErr) {
        console.warn('[Signaling:POST] DB message persist fallback to memory:', dbErr);
      }

      // Bridge envelope to Ably Realtime channel if configured
      if (process.env.ABLY_API_KEY && !process.env.ABLY_API_KEY.includes('mock-ably-key')) {
        try {
          const ably = getAblyRestClient();
          const channel = ably.channels.get(`ghost:room:${code}`);
          channel.publish('signal', envelope).catch(() => {});
        } catch (ablyErr) {
          console.warn('[Signaling:POST] Ably bridge error:', ablyErr);
        }
      }

      return NextResponse.json({ success: true, messageId: stored.id });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API:signaling] POST error:', error);
    return NextResponse.json({ error: 'Internal signaling error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('roomCode')?.toUpperCase();
  const clientId = searchParams.get('clientId');
  const since = parseInt(searchParams.get('since') || '0', 10);

  if (!roomCode || !clientId) {
    return NextResponse.json({ error: 'Missing roomCode or clientId' }, { status: 400 });
  }

  const now = Date.now();
  const memRoom = getOrCreateMemoryRoom(roomCode);

  // Update memory heartbeat
  if (memRoom.peers.has(clientId)) {
    const p = memRoom.peers.get(clientId)!;
    p.lastSeen = now;
  }

  // Attempt database query first for cross-serverless consistency
  try {
    const sinceBigInt = BigInt(since);
    const dbMessages = await db.signalingMessage.findMany({
      where: {
        roomCode,
        timestamp: { gt: sinceBigInt },
        senderId: { not: clientId },
      },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });

    const pendingMessages = dbMessages
      .filter((m) => !m.targetId || m.targetId === '*' || m.targetId === clientId)
      .map((m) => m.envelope);

    const activePeersCutoff = BigInt(now - 20000);
    const dbPeers = await db.signalingPeer.findMany({
      where: {
        roomCode,
        clientId: { not: clientId },
        lastSeen: { gt: activePeersCutoff },
      },
    });

    const activePeers = dbPeers.map((p) => p.meta);
    const hostPeer = dbPeers.find((p) => p.isHost);

    return NextResponse.json({
      messages: pendingMessages,
      peers: activePeers,
      hostId: hostPeer?.clientId || memRoom.hostId,
      serverTime: now,
    });
  } catch (dbErr) {
    // Graceful fallback to in-memory store if DB is temporarily unreachable
    const pendingMemMessages = memRoom.messages.filter((m) => {
      if (m.timestamp <= since) return false;
      if (m.senderId === clientId) return false;
      if (m.targetId && m.targetId !== '*' && m.targetId !== clientId) return false;
      return true;
    });

    const activeMemPeers = Array.from(memRoom.peers.values())
      .filter((p) => p.clientId !== clientId && now - p.lastSeen < 20000)
      .map((p) => p.meta);

    return NextResponse.json({
      messages: pendingMemMessages.map((m) => m.envelope),
      peers: activeMemPeers,
      hostId: memRoom.hostId,
      serverTime: now,
    });
  }
}
