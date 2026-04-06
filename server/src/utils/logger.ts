import pino from 'pino';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  // Base fields included in every log line
  base: {
    service: 'plama-server',
    env: process.env.NODE_ENV || 'development',
  },
});

// Request-scoped logger with correlation ID
export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('x-request-id', requestId);

  // Attach child logger with request context
  (req as any).log = logger.child({
    requestId,
    method: req.method,
    path: req.path,
  });

  // Log request completion
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    (req as any).log.info({
      statusCode: res.statusCode,
      duration,
    }, 'request completed');
  });

  next();
};