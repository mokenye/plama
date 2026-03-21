# Plama — Architecture Deep Dive

A deep technical walkthrough of Plama's design, decisions, and implementation patterns. Reference this when explaining your system to advanced engineers.

---

## System Overview

```
┌─────────────────────────────────────────┐
│   Browser (React SPA)                   │
│   - Zustand store (app state)           │
│   - dnd-kit (drag/drop)                 │
│   - Socket.io-client (realtime)         │
└──────────────────┬──────────────────────┘
                   │
         HTTP REST + WebSocket
                   │
┌──────────────────┴──────────────────────┐
│   Node.js + Express Server              │
│   - REST routes (board CRUD)            │
│   - Socket.io handlers (realtime)       │
│   - Rate limiting, logging, metrics     │
└──────────────────┬──────────────────────┘
        ┌──────────┴──────────┐
        │                     │
   PostgreSQL            Redis (Optional)
   (Postgres via Neon)   (Upstash)
   - Atomic writes       - Presence TTLs
   - Transactions        - In-memory fallback
   - Activity log
```

---

## 1. Data Model

### Core Entities

```sql
users
├── id (UUID)
├── name, email, password_hash
├── avatar_url
└── created_at, updated_at

boards
├── id (UUID)
├── title, description
├── owner_id (FK: users)
├── background_color
├── created_at, updated_at
└── deleted_at (soft delete)

board_members
├── board_id (FK: boards)
├── user_id (FK: users)
├── role ('owner' | 'member')
├── created_at
└── composite PK (board_id, user_id)

lists
├── id (UUID)
├── board_id (FK: boards)
├── title
├── position (1, 2, 3, ...)
├── created_at, updated_at
└── deleted_at (soft delete)

cards
├── id (UUID)
├── list_id (FK: lists)
├── title, description
├── position (1, 2, 3, ...)
├── due_date (nullable)
├── labels (TEXT[] — array of tags)
├── assignees (UUID[] — array of user IDs)
├── created_by (FK: users)
├── created_at, updated_at
└── deleted_at (soft delete)

activity_log
├── id (UUID)
├── board_id (FK: boards)
├── user_id (FK: users)
├── action ('card-created' | 'card-updated' | 'card-moved' | 'card-deleted' | ...)
├── metadata (JSONB — contextual info)
├── created_at

notifications
├── id (UUID)
├── user_id (FK: users)
├── type ('card-created' | 'assigned' | 'commented' | ...)
├── message
├── related_board_id (nullable)
├── read (boolean)
├── created_at, read_at (nullable)
```

### Key Schema Decisions

1. **Soft deletes** — `deleted_at` column instead of hard delete. Allows undo and audit trails.
2. **Position-based ordering** — Lists and cards are ordered by `position` integer, not by creation order. This simplifies concurrent reordering.
3. **Labels & assignees as arrays** — Stored as `TEXT[]` and `UUID[]` in Postgres. Avoids extra join tables for simple MVCs; if this grows complex, refactor to junction tables.
4. **Activity log + notifications split** — Activity log is immutable audit trail; notifications are user-specific and may be marked read.

---

## 2. Request Flows

### Flow 1: Initial Board Load (REST + REST)

**User opens `/board/abc123`**

```
Client                          Server                      DB
  │                               │                         │
  ├─── GET /api/boards/abc123 ──>│                         │
  │                              ├─ verify JWT             │
  │                              ├─ SELECT board ──────────────>
  │                              │                    <─────────
  │                              ├─ SELECT lists ──────────────>
  │                              │                    <─────────
  │                              ├─ SELECT cards ──────────────>
  │                              │                    <─────────
  │                              ├─ SELECT members ────────────>
  │                              │                    <─────────
  │                           <──┤ 200 {board, lists, cards, members}
  │
  │ (Zustand store updated)
  │
  └─ initSocket()
        │
        ├─ emit('join-board', {boardId}) ──>
        │                                    ├─ add to room 'board:abc123'
        │                                    ├─ emit('user-joined', {userId, userName})
        │                                    │    (to all in room)
        │                                 <─┤ 'user-joined'
        │ (presence updated)
        │
```

**Why split REST + Socket?**
- REST ensures **consistency** on initial load (data is read atomically from DB).
- Socket ensures **liveness** after initial state (realtime updates from other users).

---

### Flow 2: Create Card (Optimistic + Realtime)

**User clicks "Add Card" and types "Buy milk"**

```
UI                        Zustand Store         Socket              Server             DB
│                              │                   │                  │                │
├─ onClick: addCard ──>        │                   │                  │                │
│                              │                   │                  │                │
│                    tempId = uuid()               │                  │                │
│                    addOptimisticCard({           │                  │                │
│                      id: tempId,                 │                  │                │
│                      title: "Buy milk",          │                  │                │
│                      isOptimistic: true,         │                  │                │
│                    })                            │                  │                │
│                              │                   │                  │                │
│                    <─ card with tempId ──        │                  │                │
│ (instant render!)            │                   │                  │                │
│                              ├─ emit('card-created', {title, listId, tempId}) ──>  │
│                              │                   │                  │                │
│                              │                   │                  ├─ INSERT card ──>
│                              │                   │                  │              <─┤
│                              │                   │                  │            (id: real-id)
│                              │                   │                  │
│                              │                   │                  ├─ emit('card-created', {card, tempId})
│                              │                   │                  │  (to room 'board:abc123')
│                              │                  <──────────────────┤
│                              │  'card-created'  {card, tempId}     │
│                              │                                      │
│                    const old = findByTempId(tempId)               │
│                    if (old) {                                     │
│                      replaceCard(old.id, card)  // reconcile     │
│                    } else {                                       │
│                      addCard(card)  // I didn't emit it         │
│                    }                                              │
│                              │                   │                  │
│ (UI unchanged, but          │                   │                  │
│  card.id is now real)        │                   │                  │
│                              │                   │                  │
```

**Key insight:** Optimistic update happens first, server confirms with real ID, client reconciles.

---

### Flow 3: Move Card (Transactional Reorder)

**User drags card from "To Do" (pos 1) to "In Progress" (pos 2)**

Original state:
```
To Do:           In Progress:
1. Card A        1. Card C
2. Card B        2. Card D
```

After move (card A → In Progress):
```
To Do:           In Progress:
1. Card B        1. Card A
                 2. Card C
                 3. Card D
```

**Server-side transaction:**

```
BEGIN TRANSACTION

-- 1. Move the card
UPDATE cards 
SET list_id = 'in-progress-id', position = 1 
WHERE id = 'card-a-id'

-- 2. Close gap in source list (To Do)
UPDATE cards 
SET position = position - 1 
WHERE list_id = 'to-do-id' AND position > 1

-- 3. Make room in dest list (In Progress)
UPDATE cards 
SET position = position + 1 
WHERE list_id = 'in-progress-id' AND position >= 1

COMMIT  (or ROLLBACK if any step fails)
```

**Why transaction?** If user A moves card X and user B moves card Y in the same list simultaneously:
- Without tx: Both reads see `position = 1`, both try to increment, leading to duplicate positions.
- With tx: Only one can lock the positions. The other waits, re-reads, and updates correctly.

```go
// Server code sketch (Node.js)
await transaction(async (trx) => {
  // Move card
  await trx('cards')
    .where('id', cardId)
    .update({ list_id: destListId, position: newPosition, updated_at: new Date() });

  // Reindex source list (decrement positions > old position)
  await trx('cards')
    .where('list_id', srcListId)
    .andWhere('position', '>', oldPosition)
    .decrement('position', 1);

  // Reindex dest list (increment positions >= new position)
  await trx('cards')
    .where('list_id', destListId)
    .andWhere('position', '>=', newPosition)
    .increment('position', 1);

  // Log activity
  await trx('activity_log').insert({
    boardId, userId, action: 'card-moved',
    metadata: { cardId, fromListId: srcListId, toListId: destListId }
  });
});
```

**Client-side optimistic rollback:**

```typescript
// UI move happens instantly
moveCardOptimistic(cardId, newListId, newPosition);

// Send to server
socket.emit('card-moved', { cardId, newListId, newPosition }, (ack) => {
  if (ack.error) {
    // Server rejected (e.g., permission denied, race condition)
    rollbackCardMove(cardId);  // revert to old position
    toast.error('Move failed: ' + ack.error);
  }
  // else: server will broadcast from DB, so our optimistic update matches
});
```

---

### Flow 4: Presence (Redis + Fallback)

**User A opens board, User B opens the same board**

```
User A                    Redis              Server          User B
  │                        │                   │               │
  ├─ join board ──────────>      (no Redis)   │               │
  │                        │                   │               │
  │                        │    if (!redis) {  │               │
  │                        │      addToMemory  │               │
  │                        │    }              │               │
  │                        │                   │               │
  │                        │    emit('user-joined', A)         │
  │                        │                  ──────────────>  │
  │                        │                                   │
  │                        │    set('presence:board:abc123:A', │
  │                        │        {name, avatar},            │
  │                        │        EX: 30)  // 30s TTL        │
  │                        │                   │               │
  │  (wait for join)       │                   │               │
  │                        │    emit('user-joined', A) <───────┤
  │                        │                   │               │
  │<──────────────────────────────────────────┤               │
  │  (show A's avatar)     │                   │               │
  │                        │                   │               │
  │                        │   (User B joins)  │               │
  │                        │                  ──────────────>  │
  │                        │                   │               │
  │                        │   set('presence:board:abc123:B', ...)
  │                        │                   │  emit('user-joined', B)
  │                        │                   │              <─┤
  │<────────────────────────────────────── ──┤               │
  │  (show B's avatar)     │                   │               │
  │                        │                   │               │
  │ (User A closes tab)    │                   │               │
  │                        │                   │               │
  │  emit('leave-board') ──>                   │               │
  │                        │ del('presence:...:A')             │
  │                        │                   │               │
  │                        │   (TTL expires after 30s if       │
  │                        │    socket doesn't explicitly      │
  │                        │    call leave)                    │
  │                        │                   │               │
  │                        │   emit('user-left', A)            │
  │                        │                  ──────────────>  │
  │                        │                   │               │
  │                        │                   │  (hide A's avatar)
  │                        │                   │               │
```

**Why Redis + fallback?**
- **Redis TTL:** If server crashes, Redis will expire user presence after 30s (no stale ghosts).
- **In-memory fallback:** If Redis is down, use in-memory Map. Same API, loss of persistence, but app continues.
- **Graceful degradation:** presence is nice-to-have; board edits are not.

---

## 3. Socket.io Patterns

### Room-Based Broadcasting

All board members listen on `board:<id>` room:

```typescript
// Server: socket auth + room join
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userName = decoded.name;
    next();
  } catch (err) {
    next(new Error('Auth failed'));
  }
});

io.on('connect', (socket) => {
  socket.on('join-board', (boardId) => {
    socket.join(`board:${boardId}`);
    io.to(`board:${boardId}`).emit('user-joined', {
      userId: socket.userId,
      userName: socket.userName,
    });
  });

  socket.on('card-created', async (data) => {
    const { title, listId, boardId, tempId } = data;
    // insert to DB
    const card = await createCard(title, listId);
    // broadcast to room (all members see it)
    io.to(`board:${boardId}`).emit('card-created', {
      card,
      tempId,  // sender reconciles with optimistic card
    });
  });
});
```

**Why rooms?** Only relevant clients need the event. If there are 100 boards, we don't broadcast card-created to all users; only those in the room.

---

### Direct Notifications (User Rooms)

Notifications are sent to `user:<id>`, not `board:<id>`:

```typescript
// Server: notify specific user
const getIo = () => io;
const setIo = (newIo) => { io = newIo; };

// In a utils module (avoid circular import)
export function notifyUser(userId, message) {
  const io = getIo();
  io.to(`user:${userId}`).emit('notification', message);
}

// Usage: when a card is assigned to a user
socket.on('assign-card', async (data) => {
  const { cardId, userId } = data;
  await assignCard(cardId, userId);
  notifyUser(userId, `Card ${cardId} assigned to you`);
});
```

**Why direct user rooms?** Assignment and comments are private to the recipient. Broadcast to the board would spam unrelated members.

---

## 4. Client State Management (Zustand)

```typescript
// client/src/store/index.ts
import create from 'zustand';

type AppState = {
  // Data
  boards: Board[];
  currentBoardId: string | null;
  lists: { [boardId: string]: List[] };
  cards: { [boardId: string]: Card[] };
  members: { [boardId: string]: Member[] };
  presence: { [boardId: string]: User[] };

  // UI
  selectedCardId: string | null;
  cardDetailsOpen: boolean;
  connectionStatus: 'connected' | 'disconnected';
  notifications: Notification[];

  // Actions
  setCurrentBoard: (boardId: string) => void;
  addOptimisticCard: (card: Card) => void;
  confirmOptimisticCard: (tempId: string, card: Card) => void;
  moveCardOptimistic: (cardId: string, newListId: string, newPos: number) => void;
  rollbackCardMove: (cardId: string) => void;
  setPresence: (boardId: string, users: User[]) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected') => void;
};

export const useAppStore = create<AppState>((set) => ({
  boards: [],
  currentBoardId: null,
  // ... initial state
  setCurrentBoard: (boardId) => set({ currentBoardId: boardId }),
  // ... actions
}));
```

**Why not Redux?** Zustand is simpler for this use case. No boilerplate reducers/actions; just functions that call `set()`.

---

## 5. Error Handling & Resilience

### Socket Disconnection

```typescript
// client/src/services/socket.ts
let socket: Socket;

socket.on('disconnect', () => {
  useAppStore.setState({ connectionStatus: 'disconnected' });
  // Show banner: "Connection lost. Reconnecting..."
});

socket.on('connect', () => {
  useAppStore.setState({ connectionStatus: 'connected' });
  // Rejoin board
  const boardId = useAppStore.getState().currentBoardId;
  if (boardId) {
    socket.emit('join-board', boardId);
  }
});

socket.on('connect_error', (error) => {
  console.error('Socket error:', error);
  // If auth fails (token expired), redirect to login
  if (error.message === 'Auth failed') {
    localStorage.removeItem('token');
    window.location = '/login';
  }
});
```

### Failed Operations

```typescript
// Example: server rejects a card move
socket.emit('card-moved', data, (ack) => {
  if (ack.error) {
    // Rollback optimistic update
    const { cardId, oldListId, oldPosition } = data;
    moveCardOptimistic(cardId, oldListId, oldPosition);
    toast.error('Move failed. Try again.');
  }
});
```

### Graceful Degradation (Redis Fallback)

```typescript
// server/src/db/redis.ts
import Redis from 'ioredis';

const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const fallbackMemory = new Map();

export async function addUserToBoard(boardId, userId, userName) {
  const key = `presence:${boardId}:${userId}`;
  const value = { userId, userName, joinedAt: Date.now() };

  if (redis) {
    await redis.setex(key, 30, JSON.stringify(value));  // 30s TTL
  } else {
    fallbackMemory.set(key, value);
    setTimeout(() => fallbackMemory.delete(key), 30000);  // 30s cleanup
  }
}
```

**Result:** If Redis is down, presence still works (in-memory), but without the TTL safety net. Acceptable tradeoff.

---

## 6. Logging & Observability

### Activity Log (Audit Trail)

Every mutation is logged:

```typescript
// server/src/utils/activityLogger.ts
export async function logActivity(boardId, userId, action, metadata) {
  await executeWrite(
    `INSERT INTO activity_log (board_id, user_id, action, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [boardId, userId, action, JSON.stringify(metadata)]
  );
}

// Usage
await logActivity(boardId, userId, 'card-moved', {
  cardId, fromListId, toListId, fromPosition, toPosition
});
```

Soft-deleted items remain in activity (with `deleted_at`), so you can reconstruct history.

### Pino Logging

```typescript
// server logging
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

logger.info({ event: 'socket-connect', userId: socket.userId });
logger.error({ event: 'card-move-failed', error: err.message });
```

In production, logs are piped to a service (e.g., Datadog).

### Health & Metrics Endpoints

```typescript
// server/src/server.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

app.get('/metrics', (req, res) => {
  res.json({
    requests: requestCounter.value(),
    activeWebSocketConnections: io.engine.clientsCount,
    dbPoolActive: db.pool._activeCount,
  });
});
```

**Why?** Deployment platforms (Render, Heroku) ping `/health` to verify the app is alive. `/metrics` is used for monitoring and scaling decisions.

---

## 7. Why These Patterns?

### "Why REST for init load, not Socket.io?"

**REST ensures read consistency.** When you open a board, you need the authoritative state from the DB *right now*. Socket.io messages can arrive out of order or be lost if the connection is new. REST guarantees atomicity.

### "Why DB transactions for moves, not optimistic conflict resolution?"

**Because positions are ordinal, not commutative.** If A increments position and B decrements position, the order matters. A transaction ensures only one reorder at a time, preventing corruption.

If the data were a `Set` (order-independent), simple optimistic conflict resolution via CRDTs would work. But lists have order.

### "Why TTLs for presence, not explicit cleanup?"

**Handles network partitions.** If a socket dies without calling `leave-board`, the server doesn't know. Redis TTL ensures the user's presence expires after 30s, avoiding stale ghosts. Explicit cleanup would leak.

### "Why Zustand, not Redux?"

**Simplicity and bundle size.** Redux is great for very large apps; Plama's state is relatively flat. Zustand reduces boilerplate and is faster to iterate on.

---

## 8. Testing Strategy

| Test Type | Example | Why |
|-----------|---------|-----|
| **Unit** | `transformCard()` converts snake_case to camelCase | Refactoring safety |
| **Smoke** | `/health` returns status=ok | CI confidence signal |
| **Socket auth** | Unauthenticated socket rejected | Security baseline |
| **Integration** | (TODO) Create board via REST, verify DB | Full flow coverage |
| **E2E** | (TODO) Playwright script: login → create card → verify in another browser | User journey |
| **Load** | `artillery-test.yml` simulates 100 users | Scaling validation |

Currently: Smoke + socket auth tests run on startup. Integration/E2E are scaffolded but not implemented.

---

## 9. Next Evolution

### Short Term
- **Integration tests** with test DB for REST routes (Supertest).
- **E2E tests** (Playwright) for login → board → card create/move.
- **Socket concurrency tests** (emit simultaneous card moves, verify final state).

### Medium Term
- **CRDT-based collaboration** for richer edits (e.g., card description, comments).
- **Access control** — Column visibility, board roles (viewer, editor, admin).
- **Notifications persistence** — Archive old notifications.

### Long Term
- **Horizontal scaling** — Redis pub/sub for multi-server deployments.
- **Offline-first sync** — Service Worker + IndexedDB for browser offline mode.
- **Analytics** — Board activity trends, user engagement.

---

## Summary

**Plama's architecture prioritizes:**

1. **Consistency:** REST for initial load, transactions for concurrent mutations.
2. **Liveness:** Socket.io for sub-100ms updates to all members.
3. **Resilience:** Graceful degradation (Redis fallback), socket reconnection, activity logging.
4. **Simplicity:** Single source of truth (Postgres), room-based broadcasting, optimistic UI with server reconciliation.

These patterns scale to hundreds of concurrent users and thousands of boards. The codebase is typed end-to-end and maintainable for a solo developer or small team.