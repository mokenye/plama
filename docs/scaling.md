# Scaling Analysis & Strategy

## Current Architecture (MVP)

Single-server deployment, optimized for <1,000 concurrent users.

**Stack:**
- Node.js + Socket.io (in-memory adapter)
- PostgreSQL on Neon (serverless, free tier)
- Redis on Upstash (free tier, presence/caching)
- Frontend on Vercel (CDN included)

---

## Load Test Results

Run with: `npm run test:load` from root

**Setup:** Artillery, 10-minute test, up to 50 concurrent users

| Metric | Result |
|--------|--------|
| Average latency | ~45ms |
| P95 latency | ~120ms |
| P99 latency | ~180ms |
| Error rate | <0.01% |
| Requests/second | ~500 |

**Current bottlenecks:**
1. WebSocket connections — single Node.js process, ~10k connections max
2. Database writes — single primary, ~5k writes/sec max
3. Single region — latency increases for global users

---

## Scaling Phases

### Phase 1: Horizontal Scaling (~10k-50k users, ~$200/month)

**Change:** Redis Pub/Sub adapter for Socket.io

The codebase is **already structured** for this. It's a single environment variable change:

```bash
# .env
USE_REDIS_ADAPTER=true
```

```typescript
// server/src/server.ts - already written, just needs the env flag
if (scalingConfig.useRedisAdapter) {
  const { createAdapter } = await import('@socket.io/redis-adapter');
  const pubClient = createClient({ url: process.env.REDIS_PUBSUB_URL });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
}
```

**Also needed:**
- Load balancer (AWS ALB or Nginx) with sticky sessions
- 3-5 server instances (Railway or Render paid tier)
- PostgreSQL read replica (Neon paid tier supports this)

---

### Phase 2: Geographic Distribution (~100k-500k users, ~$1,500/month)

**Changes:**
- Multi-region deployment (US, EU, Asia)
- Distributed database (CockroachDB or PostgreSQL + Citus)
- CDN for static assets (already handled by Vercel)

**Database strategy:**
```sql
-- Shard boards by owner region
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_region VARCHAR(10), -- 'US', 'EU', 'ASIA'
  ...
) PARTITION BY LIST (owner_region);
```

**Why the codebase is ready:**
- `executeRead` and `executeWrite` are already separated
- Adding read replicas requires only changing `DATABASE_READ_URL` env var
- WebSocket rooms are namespaced by board ID, region-agnostic

---

### Phase 3: Message Queue (~500k-1M users, ~$5,000/month)

**Problem:** Database writes blocking WebSocket handlers

**Solution:** Decouple with BullMQ (Redis-based queue)

```typescript
// Currently (synchronous):
socket.on('card-created', async (data) => {
  const card = await db.query('INSERT INTO cards ...');
  io.to(room).emit('card-created', card);
});

// At scale (async queue):
socket.on('card-created', async (data) => {
  // Broadcast optimistically (instant)
  io.to(room).emit('card-created', { ...data, optimistic: true });
  // Queue the DB write (non-blocking)
  await cardQueue.add('create', data);
});

// Worker process handles DB write
cardWorker.process('create', async (job) => {
  const card = await db.query('INSERT INTO cards ...');
  // Confirm with real card data
  io.to(room).emit('card-confirmed', { card, tempId: job.data.tempId });
});
```

---

### Phase 4: Microservices (~1M+ users, $10,000+/month)

**Service decomposition:**

```
API Gateway
├── Auth Service (Node.js)
├── Board Service (Node.js)
├── Real-time Service (Node.js + Socket.io cluster)
├── Notification Service (Node.js)
└── Search Service (Elasticsearch)
```

**Inter-service communication:**
- REST for synchronous queries
- Kafka/RabbitMQ for async events
- gRPC for high-frequency service calls

---

## Scaling Trigger Metrics

| Metric | Current | Add Capacity At |
|--------|---------|-----------------|
| Concurrent WebSocket connections | ~100 | 800 |
| DB write queries/sec | ~50 | 3,000 |
| API response time P99 | ~180ms | 500ms |
| Memory per server | ~250MB | 1.5GB |

**Monitoring (production):**
- Application: Datadog or New Relic
- Errors: Sentry
- Uptime: Better Stack
- Logs: CloudWatch or Papertrail
- Alerts: PagerDuty for P99 > 500ms or error rate > 1%

---

## Why I Haven't Implemented Phases 2-4

1. **Not needed yet** — current load tests show comfortable headroom
2. **Premature optimization** — would slow feature development
3. **Cost** — each phase multiplies infrastructure cost
4. **Code is structured for it** — can enable with environment flags when metrics demand it

My appproach in production: **scale based on data, not assumptions.**