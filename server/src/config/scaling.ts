// ================================
// Scaling Feature Flags
// Toggle these via environment variables when metrics demand it.
// Current defaults = free single-server setup.
// ================================

export const scalingConfig = {
  // Set to 'true' to enable Redis Pub/Sub adapter for Socket.io
  // Required for horizontal scaling (multiple server instances)
  useRedisAdapter: process.env.USE_REDIS_ADAPTER === 'true',

  // Set to 'true' to route reads to a separate replica pool
  // Set DATABASE_READ_URL to your replica connection string
  useReadReplicas: process.env.USE_READ_REPLICAS === 'true',

  // Set to 'true' to enable Redis query caching
  enableCaching: process.env.ENABLE_CACHING === 'true',

  // Set to 'true' to broadcast live cursor positions
  enableCursors: process.env.ENABLE_CURSORS === 'true',

  // Max WebSocket connections before we should consider scaling
  // Node.js single process handles ~10k comfortably
  maxConnectionsWarningThreshold: parseInt(process.env.MAX_CONNECTIONS || '800'),
};