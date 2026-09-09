/**
 * Keeps development traffic from ever meeting production traffic.
 *
 * Both run against the same Ably app and the same Postgres unless someone
 * provisions a second set, and signaling only needs a matching room code to
 * bridge them: a dev client and a production client that happen to pick the same
 * code land in the same channel and form a real call. Namespacing every channel
 * and every stored room code makes that impossible by construction rather than
 * by luck.
 *
 * The value is resolved from the environment the code was served by, so a local
 * dev server hands its own clients "dev" and Vercel hands its clients "prod" -
 * they cannot disagree.
 */
const RAW_NAMESPACE =
  process.env.NEXT_PUBLIC_SIGNALING_NAMESPACE?.trim() ||
  (process.env.NODE_ENV === 'production' ? 'prod' : 'dev');

/** Only plain identifiers: this ends up in channel names and capability keys. */
export const SIGNALING_NAMESPACE = /^[A-Za-z0-9_-]{1,32}$/.test(RAW_NAMESPACE)
  ? RAW_NAMESPACE.toLowerCase()
  : 'dev';

export const IS_PRODUCTION_NAMESPACE = SIGNALING_NAMESPACE === 'prod';

/**
 * Room code as the signaling layer sees it: what names the Ably channel and what
 * goes in the `roomCode` column. The code shown to the user never changes.
 */
export function namespacedRoomCode(roomCode: string): string {
  const code = roomCode.toUpperCase();
  return IS_PRODUCTION_NAMESPACE ? code : `${SIGNALING_NAMESPACE.toUpperCase()}_${code}`;
}

/** Ably channel carrying a room's signaling. */
export function roomChannelName(roomCode: string): string {
  return `ghost:${SIGNALING_NAMESPACE}:room:${roomCode.toUpperCase()}`;
}

/** Ably channel a device receives its call invites on. */
export function inboxChannelName(deviceId: string): string {
  return `inbox:${SIGNALING_NAMESPACE}:${deviceId}`;
}

/** Wildcard for "any other device's inbox", used to grant publish-only rights. */
export function inboxWildcard(): string {
  return `inbox:${SIGNALING_NAMESPACE}:*`;
}
