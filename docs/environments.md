# Development vs production

Signaling is a shared cloud service, not something each environment gets its own
copy of by default. A local `next dev` and the Vercel deployment both talk to the
same Ably app and the same Neon database unless you deliberately split them —
and signaling only needs a matching room code to bridge two clients. A dev client
and a production client that picked the same code would land in the same channel
and form a real call.

Two layers keep that from happening. The first is automatic; the second is worth
doing before the app carries real traffic.

## 1. Namespacing (automatic)

Every signaling channel and every stored room code carries the environment name:

| | development | production |
| :--- | :--- | :--- |
| Ably room channel | `ghost:dev:room:ABC-DEF-GHI` | `ghost:prod:room:ABC-DEF-GHI` |
| Ably inbox channel | `inbox:dev:<deviceId>` | `inbox:prod:<deviceId>` |
| `roomCode` column | `DEV_ABC-DEF-GHI` | `ABC-DEF-GHI` |

The namespace comes from the environment that *served the page*, so a local
server hands its own clients `dev` and Vercel hands its clients `prod` — they
cannot disagree. The room code shown to the user never changes.

Nothing to configure. `NEXT_PUBLIC_SIGNALING_NAMESPACE` only exists for running
more than two isolated environments off one Ably app (`staging`, `qa`, ...).

The Ably token capability is namespaced too, so a dev client is not merely
pointed at different channels — it has no permission to reach production ones.

## 2. Separate credentials (recommended)

Namespacing stops the two from meeting. It does not stop a development run from
writing rows into the production database, or from spending the production Ably
quota. For that, give development its own credentials.

Create `.env.development.local` — Next.js loads it for `next dev` and ignores it
in production builds, and it is already gitignored:

```env
POSTGRES_PRISMA_URL="<dev branch connection string>"
POSTGRES_URL_NON_POOLING="<dev branch direct connection string>"
ABLY_API_KEY="<a second Ably app's key>"
```

**Database.** Neon branches a database in seconds and the branch is free: create
one from the production branch and point the two URLs at it. `npx prisma db push`
against it once and development has a full schema with none of the real data.

**Ably.** A second app in the same Ably account gives development its own key and
its own quota.

## Maintenance

Nothing prunes the signaling tables on their own. `SignalingPeer` rows are
deleted only when a client sends an explicit "leave", so a crashed tab leaves its
row behind forever; `SignalingMessage` is swept only when someone posts to that
same room again, so a finished room's messages linger indefinitely.

```bash
node scripts/cleanup-signaling.mjs --list                   # what is in there
node scripts/cleanup-signaling.mjs --stale --older-than=60  # sweep old rows
node scripts/cleanup-signaling.mjs --rooms=A,B --dry-run    # target specific rooms
```

Deleting stale rows cannot disturb a live call: the app treats a peer as gone
after 20s without a heartbeat and ignores messages older than 90s, so anything
past a few minutes is already invisible to every client.
