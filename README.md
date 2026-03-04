# <img src="client/public/plama.svg" width="32" height="32" style="vertical-align:middle" alt="Plama logo" /> Plama

> Real-time collaborative project board. Multiple users, one board, zero friction.

![Demo placeholder — add GIF of two browser windows showing real-time sync]

**Live demo:** [plama.vercel.app](https://plama.vercel.app) *(deploy and update link)*

---

## What Problem Does This Solve?

Remote teams need lightweight, real-time collaboration without the complexity or cost of Trello or Jira. Plama demonstrates production-grade real-time architecture — the same patterns used in trading platforms, collaborative design tools, and live dashboards — applied to a problem everyone understands.

---

## Features

- **Real-time sync** — Card and list changes propagate to all users in <50ms
- **Optimistic UI** — Every action feels instant; the UI updates before the server confirms
- **Live presence** — See who's online, who's away, and who's actively on your board
- **Drag-and-drop** — Reorder cards within lists, move cards across lists, reorder lists — all synced in real time
- **Notifications** — Personal alerts pushed instantly via WebSocket (assignment, comments, invites, card moves); badge updates without polling
- **Board ownership** — Dashboard separates your boards from boards shared with you, with owner attribution
- **Activity log** — Full board history: who did what and when
- **Undo** — Destructive actions (delete card, delete list, delete board) have a 5-second cancellation window before committing
- **Conflict resolution** — Concurrent card moves are wrapped in database transactions; failed operations roll back gracefully on all clients
- **Auth** — JWT-based authentication with protected routes and role-aware UI (owners vs. members)
- **Dark mode** — Persistent preference, toggle from any screen
- **Graceful degradation** — Connection loss banner, automatic reconnection, board rejoin on reconnect

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT (React SPA)                         │
│   React + TypeScript + Zustand + @dnd-kit + Socket.io-client     │
└────────────────────────┬────────────────────────────────────────┘
                         │
            HTTP REST + WebSocket (Socket.io)
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                      SERVER (Node.js)                            │
│          Express REST API + Socket.io Event Handlers             │
└──────────────┬──────────────────────────┬───────────────────────┘
               │                          │
        ┌──────┴──────┐          ┌────────┴────────┐
        │ PostgreSQL  │          │     Redis        │
        │  (Neon)     │          │   (Upstash)      │
        │ Persistent  │          │ Presence/Cache   │
        │   storage   │          │                  │
        └─────────────┘          └─────────────────┘
```

**Communication pattern:**
- **REST API** — Auth, initial board load, list and board CRUD
- **WebSocket (board room)** — All card mutations, list moves, presence events; broadcast to `board:{id}` room
- **WebSocket (user socket)** — Personal notifications pushed directly to the recipient's socket, bypassing the board room entirely

**Why this split?** REST for correctness (initial data must be consistent), WebSocket for speed (real-time events need sub-100ms propagation), and direct socket targeting for notifications (only the recipient should receive them).

---

## Technical Highlights

### Real-time Event Flow

```
User drags card
  → UI updates immediately (optimistic)
  → socket.emit('card-moved', { cardId, newListId, newPosition })
  → Server opens a PostgreSQL transaction
      → UPDATE cards SET list_id, position   (move the card)
      → UPDATE cards SET position - 1        (close gap in old list)
      → UPDATE cards SET position + 1        (make room in new list)
      → COMMIT  (or ROLLBACK if any step fails)
  → io.to('board:123').emit('card-moved', data)  ← broadcast to all
  → Other clients update their UI
  → If transaction fails → 'card-move-failed' → sender rolls back optimistic update
```

### Optimistic Updates

Every card mutation updates the local UI before server confirmation:

```typescript
// 1. Update UI immediately (0ms perceived latency)
addOptimisticCard({ ...card, isOptimistic: true, tempId });

// 2. Send to server via WebSocket
socket.emit('card-created', { ...data, tempId });

// 3a. Server confirms → replace optimistic card with real DB record
socket.on('card-created', ({ card, tempId }) => {
  const hasOptimistic = store().cards.find(c => c.tempId === tempId);
  hasOptimistic
    ? confirmOptimisticCard(tempId, card)  // sender: swap temp → real
    : addCard(card);                        // others: just add it
});

// 3b. Server fails → rollback
socket.on('card-error', ({ tempId }) => rollbackOptimisticCard(tempId));
```

### Concurrency

Card moves use a dedicated PostgreSQL transaction to prevent position corruption when two users move different cards in the same list simultaneously:

```typescript
await executeTransaction(async (client) => {
  await client.query(`UPDATE cards SET list_id=$1, position=$2 WHERE id=$3`, [...]);
  await client.query(`UPDATE cards SET position=position-1 WHERE list_id=$1...`, [...]);
  await client.query(`UPDATE cards SET position=position+1 WHERE list_id=$1...`, [...]);
  // All three succeed together, or all roll back
});
```

### Notifications Architecture

Notifications are pushed directly to the recipient rather than broadcast to the board room. This required breaking a circular import (`server.ts` → `handlers.ts` → `notifications.ts` → `server.ts`) with a dependency injection pattern:

```typescript
// notifications.ts — no direct import of io
let _io: Server | null = null;
export function setIo(io: Server) { _io = io; }

// server.ts — injects io after creation
setIo(io);

// On invite: push board data directly to recipient's socket(s)
for (const socketId of userSockets.get(inviteeId)) {
  _io.to(socketId).emit('notification', notification);
  _io.to(socketId).emit('board-invited', { board }); // dashboard updates instantly
}
```

### Presence Tracking

Redis hash per board stores active users with TTL. In-memory fallback if Redis is unavailable:

```typescript
await redis.hSet(`board:${boardId}:users`, userId, JSON.stringify({ id, name, joinedAt }));
await redis.expire(`board:${boardId}:users`, 3600);
```

### Socket Lifecycle

A named handler pattern prevents listener accumulation across React re-renders and board navigations:

```typescript
// All handlers stored by name — unbind removes only these, not all listeners
(socket as any)._boardHandlers = { onConnect, onCardCreated, onCardMoved, ... };

// Clean unbind on board unmount
s.off('card-created', h.onCardCreated);
s.off('card-moved',   h.onCardMoved);
// ...
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript + Vite | Type safety, fast HMR, modern bundling |
| State | Zustand | Minimal boilerplate, built for real-time mutation patterns |
| Real-time | Socket.io | Battle-tested WebSocket with rooms, reconnection, fallbacks |
| Drag & drop | @dnd-kit | Accessible, TypeScript-native, sortable contexts |
| Backend | Node.js + Express | Event-driven I/O, natural fit for WebSocket workloads |
| Database | PostgreSQL (Neon) | ACID transactions, relational integrity, serverless scaling |
| Cache/Presence | Redis (Upstash) | Sub-millisecond reads, built-in pub/sub for future scaling |
| Auth | JWT | Stateless, works cleanly with WebSocket handshake auth |
| Validation | Zod | Runtime type safety on all API inputs |
| Logging | Pino | Structured JSON logs, negligible overhead |
| Deploy | Vercel + Northflank | Zero-config CI/CD, global CDN for static assets |

---

## Local Setup

### Prerequisites
- Node.js 20+
- Docker (for local PostgreSQL + Redis) **or** free accounts at [Neon](https://neon.tech) and [Upstash](https://upstash.com)

### 1. Clone & install

```bash
git clone https://github.com/yourusername/plama.git
cd plama

cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cd server && cp .env.example .env
# Fill in: DATABASE_URL, REDIS_URL, JWT_SECRET, CLIENT_URL

cd ../client && cp .env.example .env
# VITE_API_URL can be left empty for local dev (Vite proxy handles it)
```

### 3. Set up database

```bash
# Option A: Docker
docker run --name plama-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=plama -p 5432:5432 -d postgres
docker run --name plama-redis -p 6379:6379 -d redis

# Option B: Neon + Upstash (free cloud tiers) — update .env with their connection strings

# Run migrations
cd server && npm run db:migrate
```

### 4. Start

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment

| Service | Used For | Cost |
|---------|----------|------|
| Vercel | Frontend + CDN | Free |
| Northflank | Backend server | Free tier (no spin-down) |
| Neon | PostgreSQL | Free (500MB) |
| Upstash | Redis | Free (10k req/day) |

**Total: $0/month**

### Backend → Northflank
1. Create a free account at [northflank.com](https://northflank.com)
2. Create a new project
3. Add a PostgreSQL addon — copy the connection string
4. Add a Redis addon — copy the connection string
5. Create a combined service, connect your GitHub repo, set root to `server/`
6. Build command: `npm install && npm run build && npm run db:migrate`
7. Start command: `npm start`
8. Add environment variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`
9. Deploy — Northflank containers stay running (no spin-down)

### Frontend → Vercel
```bash
cd client && vercel --prod
# Set VITE_API_URL to your Northflank backend URL
```

---

## Performance

Load tested with Artillery — up to 50 concurrent users, 10-minute sustained run:

| Metric | Result |
|--------|--------|
| Average latency | ~45ms |
| P95 latency | ~120ms |
| P99 latency | ~180ms |
| Error rate | <0.01% |
| Requests/second | ~500 |

```bash
npm run test:load
```

See [docs/scaling.md](docs/scaling.md) for bottleneck analysis and the path to 1M+ users.

---

## Project Structure

```
plama/
├── client/
│   └── src/
│       ├── components/       # Board, List, Card, Notifications, UI
│       ├── hooks/            # useBoard (real-time state + actions), useUndo
│       ├── services/         # api.ts (REST), socket.ts (WebSocket + named handlers)
│       ├── store/            # Zustand stores (auth, boards, active board)
│       └── types/            # Shared TypeScript types
│
└── server/
    └── src/
        ├── routes/           # REST endpoints (auth, boards, lists, cards, notifications)
        ├── socket/           # WebSocket handlers (real-time core + concurrency logic)
        ├── db/               # PostgreSQL pools, executeTransaction, Redis client
        ├── middleware/       # JWT auth, metrics
        └── utils/            # Notifications (socket push + DB), activity logger, transforms
```

---

## What I Learned

- **WebSocket architecture** — Event-driven systems require different mental models than request/response. Designing clean event contracts and handling the full lifecycle (connect, reconnect, room rejoin, cleanup) is non-trivial.
- **Optimistic updates** — The happy path is easy. The hard part is rollback: making sure failed server operations cleanly undo local state without jarring the user.
- **Concurrency** — Silent data corruption is worse than visible errors. Wrapping multi-step position updates in a database transaction turned a potential source of subtle bugs into a clear commit-or-rollback guarantee.
- **Circular dependencies** — Real-time systems that need to push events from utility code create circular import chains. Dependency injection (passing `io` in rather than importing it) is the clean solution.
- **Listener lifecycle** — Naive WebSocket code accumulates duplicate event listeners on re-render. Named handler references and explicit unbinding on unmount are essential for correctness.
- **Scale first in structure, not in code** — The codebase separates read/write DB pools, uses environment flags for Redis pub/sub and read replicas, and namespaces all socket rooms. None of that costs anything now, but it means scaling later doesn't require a rewrite.

---

## License

MIT