import { Request, Response, NextFunction } from 'express';

// Simple in-memory metrics
// In production: swap for Prometheus + Grafana
export const metrics = {
  requests: 0,
  errors: 0,
  responseTime: [] as number[],
  activeConnections: 0,
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  metrics.requests++;
  metrics.activeConnections++;

  res.on('finish', () => {
    const duration = Date.now() - start;

    // Keep last 1000 response times to avoid memory leak
    if (metrics.responseTime.length >= 1000) {
      metrics.responseTime.shift();
    }
    metrics.responseTime.push(duration);

    metrics.activeConnections--;

    if (res.statusCode >= 400) {
      metrics.errors++;
    }
  });

  next();
};