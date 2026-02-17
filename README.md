# 🗂️ Plama

> Real-time collaborative project board. Multiple users, one board, zero lag.

![Demo placeholder - add GIF of two browser windows showing real-time sync]

**Live demo:** [plama.vercel.app](https://plama.vercel.app) *(deploy and update link)*

---

## What Problem Does This Solve?

Remote teams need lightweight, real-time collaboration without the complexity and cost of Trello or Jira. This demonstrates production-grade real-time architecture patterns applicable to trading platforms, collaborative tools, live dashboards, and any system requiring multi-user state synchronization.

---

## Features

- **Real-time sync** — Card updates propagate to all users in <50ms
- **Optimistic UI** — Actions feel instant; UI updates before server confirms
- **Live presence** — See who's online on your board
- **Conflict resolution** — Server is source of truth; failed operations roll back gracefully
- **Drag-and-drop** — Reorder cards and move across lists
- **Auth** — JWT-based authentication with protected routes
- **Graceful degradation** — Connection loss banner, auto-reconnection

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React SPA)                       │
│  React + TypeScript + Zustand + @dnd-kit + Socket.io-client  │
└──────────────────────────┬──────────────────────────────────┘
                           │
              HTTP REST + WebSocket (Socket.io)
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                    SERVER (Node.js)                           │
│         Express REST API + Socket.io Event Handlers           │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
        ┌──────┴──────┐          ┌────────┴────────┐
        │ PostgreSQL  │          │      Redis       │
        │  (Neon)     │          │   (Upstash)      │
        │ Persistent  │          │ Presence/Cache   │
        │   storage   │          │                  │
        └─────────────┘          └──────────────────┘
```

**Communication pattern:**
- **REST API** — Auth, initial board load, list CRUD
- **WebSocket** — All card mutations (create, update, move, delete), presence

**Why this split?** REST for consistency (initial data must be correct), WebSocket for speed (real-time events need sub-100ms propagation).

---

## Technical Highlights

### Real-time Event Flow

```
User drags card
  → UI updates immediately (optimistic)
  → socket.emit('card-moved', { cardId, newListId, newPosition })
  → Server validates & saves to PostgreSQL
  → io.to('board:123').emit('card-moved', data)  ← broadcast to all
  → Other clients update their UI
  → If server fails → 'card-move-failed' → client rolls back
```

### Optimistic Updates

Every card mutation updates the local UI before server confirmation:

```typescript
// 1. Update UI immediately (0ms perceived latency)
addOptimisticCard({ ...card, isOptimistic: true, tempId });

// 2. Send to server via WebSocket
socket.emit('card-created', { ...data, tempId });

// 3a. Server confirms → replace optimistic with real card
socket.on('card-created', ({ card, tempId }) => confirmOptimisticCard(tempId, card));

// 3b. Server fails → rollback
socket.on('card-error', ({ tempId }) => rollbackOptimisticCard(tempId));
```

### Presence Tracking

Redis hash per board stores active users with TTL:

```typescript
await redis.hSet(`board:${boardId}:users`, userId, JSON.stringify({ id, name, joinedAt }));
await redis.expire(`board:${boardId}:users`, 3600);
```

### Database Design

Positions use integer ordering with server-side rebalancing on move. Indexed for performance:

```sql
CREATE INDEX idx_cards_list_position ON cards(list_id, position);
```

### Scaling-Ready Structure

Codebase uses environment flags to enable scaling features without refactoring:

```bash
USE_REDIS_ADAPTER=true    # Socket.io Redis Pub/Sub (horizontal scaling)
USE_READ_REPLICAS=true    # Separate read/write DB pools
ENABLE_CACHING=true       # Redis query caching
ENABLE_CURSORS=true       # Live cursor tracking
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + TypeScript + Vite | Type safety, fast HMR, modern bundling |
| State | Zustand | Minimal boilerplate, perfect for real-time updates |
| Real-time | Socket.io | Battle-tested WebSocket library |
| Drag & drop | @dnd-kit | Accessible, TypeScript-native |
| Backend | Node.js + Express | Event-driven, perfect for WebSocket I/O |
| Database | PostgreSQL (Neon) | ACID compliance, relational integrity |
| Cache/Presence | Redis (Upstash) | Sub-millisecond reads, built-in pub/sub |
| Auth | JWT (jsonwebtoken) | Stateless, works with WebSocket auth |
| Validation | Zod | Runtime type safety on API inputs |
| Logging | Pino | Structured JSON logs, production-ready |
| Deploy | Vercel + Render | Free tier, global CDN, CI/CD |

---

## Local Setup

### Prerequisites
- Node.js 20+
- Docker (for local PostgreSQL + Redis) **or** free accounts at [Neon](https://neon.tech) and [Upstash](https://upstash.com)

### 1. Clone & install

```bash
git clone https://github.com/yourusername/plama.git
cd plama

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment

```bash
# Server
cd server
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, JWT_SECRET

# Client
cd ../client
cp .env.example .env
# Leave VITE_API_URL empty for local development (uses Vite proxy)
```

### 3. Set up database

```bash
# Option A: Docker (local)
docker run --name plama-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=plama -p 5432:5432 -d postgres
docker run --name plama-redis -p 6379:6379 -d redis

# Option B: Use Neon + Upstash (free cloud services) - update .env with their URLs

# Run migrations
cd server && npm run db:migrate
```

### 4. Start development servers

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment (Free)

| Service | Used For | Cost |
|---------|----------|------|
| Vercel | Frontend hosting + CDN | Free |
| Render | Backend server | Free (750hrs/month) |
| Neon | PostgreSQL | Free (500MB) |
| Upstash | Redis | Free (10k req/day) |

**Total: $0/month**

### Deploy Backend to Render
1. Connect GitHub repo to [Render](https://render.com)
2. Select `server/` as root directory
3. Build: `npm install && npm run build && npm run db:migrate`
4. Start: `npm start`
5. Add environment variables in Render dashboard

### Deploy Frontend to Vercel
```bash
cd client
vercel --prod
# Set VITE_API_URL to your Render URL
```

---

## Performance

```bash
# Run load tests
npm run test:load
```

See [docs/scaling.md](docs/scaling.md) for full scaling analysis, bottleneck breakdown, and the path to 1M+ users.

---

## Project Structure

```
plama/
├── client/                   # React frontend
│   └── src/
│       ├── components/       # UI components (Board, List, Card, Auth)
│       ├── hooks/            # useBoard - real-time data + actions
│       ├── services/         # api.ts (REST) + socket.ts (WebSocket)
│       ├── store/            # Zustand state management
│       └── types/            # Shared TypeScript types
│
├── server/                   # Node.js backend
│   └── src/
│       ├── routes/           # REST API routes (auth, boards, lists, cards)
│       ├── socket/           # WebSocket event handlers (the real-time core)
│       ├── db/               # PostgreSQL connection, migrations, Redis
│       ├── middleware/       # Auth (JWT), metrics
│       └── utils/            # Logger, JWT helpers
│
├── docs/
│   └── scaling.md            # Scaling analysis & production roadmap
├── artillery-test.yml        # Load testing config
└── .github/workflows/ci.yml  # CI/CD pipeline
```

---

## What I Learned

- **WebSocket architecture** — Event-driven systems require different mental models than request/response. Designing clean event contracts up front matters.
- **Optimistic updates** — Balancing perceived performance vs. data correctness. Rollback logic is as important as the happy path.
- **Distributed state** — When multiple clients share state, you must decide: who owns the truth? (Server, with client predictions.)
- **Connection lifecycle** — Handling reconnection, room rejoin, and cleanup on disconnect is non-trivial.
- **Structuring for scale** — Writing code that works at 100 users but can scale to 100k with environment flags, not rewrites.

---

## Future Improvements

- [ ] Cursor tracking (live cursors like Figma)
- [ ] Card comments
- [ ] Board invitation via email
- [ ] Activity feed (event sourcing)
- [ ] Operational Transform / CRDTs for concurrent edits
- [ ] Full-text search (Postgres `tsvector` or Typesense)
- [ ] Dark mode (Tailwind CSS variables)

---

## License

MIT