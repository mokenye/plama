import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { logger, requestLoggerMiddleware } from './utils/logger';
import { metricsMiddleware, metrics } from './middleware/metrics';
import { register, wsConnectionsActive } from './metrics';
import { setupSocketHandlers } from './socket/handlers';
import { setIo } from './utils/notifications';
import { testDatabaseConnection } from './db/connection';
import { connectRedis } from './db/redis';

// Routes
import authRoutes from './routes/auth';
import boardRoutes from './routes/boards';
import cardRoutes from './routes/cards';
import listRoutes from './routes/lists';
import memberRoutes from './routes/members';
import commentRoutes from './routes/comments';
import activityRoutes from './routes/activity';
import notificationRoutes from './routes/notifications';

dotenv.config();

// ================================
// App Setup
// ================================
const app = express();
const httpServer = createServer(app);

// ================================
// Socket.io Setup
// ================================
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
  // Ping/pong for connection health
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Give notifications util a reference to io without creating a circular import
setIo(io); 

// Track WebSocket connections for Prometheus
io.on('connection', () => {
  wsConnectionsActive.inc();
});
io.engine.on('connection_error', () => {});
io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    wsConnectionsActive.dec();
  });
});
// This allows us to emit notifications from anywhere in the codebase without importing the server directly, which can lead to circular dependencies. 
// Cicular dependencies can cause issues in Node.js, such as modules being partially loaded, which can lead to unexpected behavior. By using a setter function like setIo, we can avoid this problem while still providing access to the Socket.io instance where it's needed. 
// Here, we call setIo(io) after creating the Socket.io server, allowing us to store the reference to io in a way that can be accessed by other modules without directly importing the server module. This is a common pattern to avoid circular dependencies while still sharing important instances across the application.

// ================================
// Middleware
// ================================
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
  next()
})
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(metricsMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300'),
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true, // Returns limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});

const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS || '10'),     // Only 10 login attempts per 15 mins
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/', limiter);

// Warmup
app.get('/api/ping', (req, res) => res.sendStatus(200));

// ================================
// Routes
// ================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get('/metrics', (req, res) => {
  const avgResponseTime =
    metrics.responseTime.length > 0
      ? metrics.responseTime.reduce((a, b) => a + b, 0) / metrics.responseTime.length
      : 0;

  res.json({
    requests: metrics.requests,
    errors: metrics.errors,
    errorRate: metrics.requests > 0
      ? ((metrics.errors / metrics.requests) * 100).toFixed(2) + '%'
      : '0%',
    avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
    activeConnections: metrics.activeConnections,
    activeWebSocketConnections: io.engine.clientsCount,
  });
});

// Prometheus metrics endpoint (text format for scraping)
app.get('/metrics/prometheus', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end();
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/boards', cardRoutes);
app.use('/api/boards', listRoutes);
app.use('/api/boards', memberRoutes);
app.use('/api/boards', activityRoutes);
app.use('/api/cards', commentRoutes);
app.use('/api/notifications', notificationRoutes);

// ================================
// WebSocket Handlers
// ================================
setupSocketHandlers(io);

// ================================
// Graceful Shutdown
// ================================
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully...`);

  // Stop accepting new HTTP connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close WebSocket connections
  io.close(() => {
    logger.info('Socket.io closed');
  });

  // Give connections time to close
  setTimeout(() => {
    logger.info('Graceful shutdown complete');
    process.exit(0);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ================================
// Start Server
// ================================
const PORT = parseInt(process.env.PORT || '3000');

const start = async () => {
  // Test database connection before starting
  await testDatabaseConnection();

  // Connect to Redis
  await connectRedis();

  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    logger.info(`📊 Metrics: http://localhost:${PORT}/metrics`);
    logger.info(`❤️  Health: http://localhost:${PORT}/health`);
  });
};

start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export { io };