#!/usr/bin/env node
/**
 * Maintenance for the signaling tables.
 *
 * Nothing prunes these on its own: SignalingPeer rows are only deleted when a
 * client sends an explicit "leave", so a crashed tab or a closed laptop leaves
 * its row behind forever, and SignalingMessage is only swept when someone posts
 * to that same room again - a finished room's messages linger indefinitely. Both
 * grow without bound in a database nobody is watching.
 *
 * Deleting stale rows cannot disturb a live call: the app treats a peer as gone
 * after 20s without a heartbeat and ignores messages older than 90s, so anything
 * past a few minutes is already invisible to every client.
 *
 *   node scripts/cleanup-signaling.mjs --list
 *   node scripts/cleanup-signaling.mjs --rooms=A,B --dry-run
 *   node scripts/cleanup-signaling.mjs --rooms=A,B
 *   node scripts/cleanup-signaling.mjs --stale --older-than=10
 */

import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const value = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const dryRun = has('--dry-run');
const listOnly = has('--list');
const stale = has('--stale');
const rooms = (value('rooms') || '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
const olderThanMinutes = Number(value('older-than') || 10);

const db = new PrismaClient();

async function list() {
  const peers = await db.signalingPeer.findMany({ orderBy: { createdAt: 'asc' } });
  const messages = await db.signalingMessage.groupBy({ by: ['roomCode'], _count: true });

  const rows = new Map();
  for (const p of peers) {
    const row = rows.get(p.roomCode) || { peers: 0, messages: 0, oldest: p.createdAt };
    row.peers += 1;
    if (p.createdAt < row.oldest) row.oldest = p.createdAt;
    rows.set(p.roomCode, row);
  }
  for (const m of messages) {
    const row = rows.get(m.roomCode) || { peers: 0, messages: 0, oldest: null };
    row.messages = m._count;
    rows.set(m.roomCode, row);
  }

  if (rows.size === 0) {
    console.log('Signaling tables are empty.');
    return;
  }

  console.log('room                 | peers | messages | oldest peer');
  console.log('---------------------|-------|----------|--------------------------');
  for (const [room, row] of rows) {
    console.log(
      room.padEnd(20),
      '|',
      String(row.peers).padStart(5),
      '|',
      String(row.messages).padStart(8),
      '|',
      row.oldest ? row.oldest.toISOString() : '-'
    );
  }
}

async function remove(where, label) {
  const peers = await db.signalingPeer.findMany({ where });
  const messages = await db.signalingMessage.findMany({ where });

  console.log(`${label}: ${peers.length} peer row(s), ${messages.length} message row(s).`);
  for (const room of new Set([...peers, ...messages].map((r) => r.roomCode))) {
    console.log(`  - ${room}`);
  }

  if (dryRun) {
    console.log('\nDry run: nothing deleted.');
    return;
  }
  if (peers.length === 0 && messages.length === 0) return;

  const p = await db.signalingPeer.deleteMany({ where });
  const m = await db.signalingMessage.deleteMany({ where });
  console.log(`\nDeleted ${p.count} peer row(s) and ${m.count} message row(s).`);
}

try {
  if (listOnly || (!rooms.length && !stale)) {
    await list();
    if (!listOnly) {
      console.log('\nPass --rooms=CODE1,CODE2 to delete specific rooms, or --stale to sweep old rows.');
    }
  } else if (rooms.length) {
    await remove({ roomCode: { in: rooms } }, `Rooms ${rooms.join(', ')}`);
  } else {
    const cutoff = BigInt(Date.now() - olderThanMinutes * 60_000);
    await remove(
      { lastSeen: { lt: cutoff } },
      `Stale rows older than ${olderThanMinutes} minute(s)`
    );
  }
} catch (err) {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
