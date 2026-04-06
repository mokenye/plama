import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

export const register = new Registry();

collectDefaultMetrics({ register });

// ================================
// HTTP Metrics
// ================================
export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [register],
});

// ================================
// WebSocket Metrics
// ================================
export const wsConnectionsActive = new Gauge({
  name: 'ws_connections_active',
  help: 'Currently connected WebSocket clients',
  registers: [register],
});

export const wsBoardRoomSize = new Gauge({
  name: 'ws_board_room_size',
  help: 'Users in each board room',
  labelNames: ['board_id'] as const,
  registers: [register],
});

export const wsEventsTotal = new Counter({
  name: 'ws_events_total',
  help: 'WebSocket events received by type',
  labelNames: ['event'] as const,
  registers: [register],
});

export const wsEventDuration = new Histogram({
  name: 'ws_event_duration_seconds',
  help: 'Time to handle a WebSocket event',
  labelNames: ['event'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// ================================
// Database Metrics
// ================================
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'PostgreSQL query duration',
  labelNames: ['operation', 'status'] as const,
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

// ================================
// Plama-specific Metrics
// ================================
export const optimisticRollbacks = new Counter({
  name: 'plama_optimistic_rollbacks_total',
  help: 'Optimistic updates rolled back after server failure',
  labelNames: ['event'] as const,
  registers: [register],
});

export const cardMovesTotal = new Counter({
  name: 'plama_card_moves_total',
  help: 'Card moves completed successfully',
  registers: [register],
});

export const notificationsSentTotal = new Counter({
  name: 'plama_notifications_sent_total',
  help: 'Notifications pushed to users',
  labelNames: ['type'] as const,
  registers: [register],
});

export const redisPresenceOps = new Counter({
  name: 'plama_redis_presence_ops_total',
  help: 'Redis presence operations',
  labelNames: ['result'] as const,
  registers: [register],
});
