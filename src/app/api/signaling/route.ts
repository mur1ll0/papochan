import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

// In-Memory Signaling Bus with TTL & Room Presence Tracking
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

// Global active rooms store in server memory
const roomsStore = new Map<string, RoomState>();

// Periodic cleanup of stale messages (> 60s) and inactive peers (> 25s)
function cleanupRoom(room: RoomState) {
  const now = Date.now();
  // Prune messages older than 45 seconds
  room.messages = room.messages.filter((m) => now - m.timestamp < 45000);

  // Prune inactive peers (no heartbeat for > 25 seconds)
  for (const [clientId, peer] of room.peers.entries()) {
    if (now - peer.lastSeen > 25000) {
      room.peers.delete(clientId);
      if (room.hostId === clientId) {
        // Assign new host if previous host left
        const nextPeer = Array.from(room.peers.values())[0];
        room.hostId = nextPeer ? nextPeer.clientId : null;
      }
    }
  }
}

function getOrCreateRoom(roomCode: string): RoomState {
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
  cleanupRoom(room);
  return room;
}

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(req, 120, 60000, 'signaling-post');
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

    const room = getOrCreateRoom(roomCode);
    const now = Date.now();

    if (action === 'heartbeat' && meta) {
      const clientId = `${meta.userId}:${meta.deviceId}`;
      const existing = room.peers.get(clientId);

      if (!room.hostId || (isHost && !existing)) {
        room.hostId = clientId;
      }

      room.peers.set(clientId, {
        clientId,
        meta,
        lastSeen: now,
        isHost: room.hostId === clientId,
      });

      return NextResponse.json({
        success: true,
        isHost: room.hostId === clientId,
        hostId: room.hostId,
        peersCount: room.peers.size,
      });
    }

    if (action === 'leave' && meta) {
      const clientId = `${meta.userId}:${meta.deviceId}`;
      room.peers.delete(clientId);
      if (room.hostId === clientId) {
        const nextPeer = Array.from(room.peers.values())[0];
        room.hostId = nextPeer ? nextPeer.clientId : null;
      }
      return NextResponse.json({ success: true });
    }

    if (envelope) {
      const stored: StoredSignal = {
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        roomCode: room.roomCode,
        senderId: envelope.senderId,
        targetId: envelope.targetId,
        envelope,
        timestamp: envelope.timestamp || now,
      };

      room.messages.push(stored);

      // Keep at most 200 recent messages per room
      if (room.messages.length > 200) {
        room.messages.shift();
      }

      // Update sender last seen
      if (envelope.senderId && room.peers.has(envelope.senderId)) {
        const peer = room.peers.get(envelope.senderId)!;
        peer.lastSeen = now;
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

  const room = getOrCreateRoom(roomCode);
  const now = Date.now();

  // Update client heartbeat
  if (room.peers.has(clientId)) {
    const peer = room.peers.get(clientId)!;
    peer.lastSeen = now;
  }

  // Filter messages for this client:
  // - Sent after `since`
  // - Broadcast (no targetId or targetId === '*') OR targeted specifically to `clientId`
  // - Not sent by the client itself
  const pendingMessages = room.messages.filter((m) => {
    if (m.timestamp <= since) return false;
    if (m.senderId === clientId) return false;
    if (m.targetId && m.targetId !== '*' && m.targetId !== clientId) return false;
    return true;
  });

  const activePeers = Array.from(room.peers.values())
    .filter((p) => p.clientId !== clientId && now - p.lastSeen < 20000)
    .map((p) => p.meta);

  return NextResponse.json({
    messages: pendingMessages.map((m) => m.envelope),
    peers: activePeers,
    hostId: room.hostId,
    serverTime: now,
  });
}
