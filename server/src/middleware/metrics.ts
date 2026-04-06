import { Request, Response, NextFunction } from 'express';
import { httpRequestTotal, httpRequestDuration } from '../metrics';

// Simple in-memory metrics (kept for backward-compatible /metrics JSON endpoint)
export const metrics = {
  requests: 0,
  errors: 0,
  responseTime: [] as number[],
  activeConnections: 0,
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const end = httpRequestDuration.startTimer();

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

    // Prometheus metrics — use route pattern to avoid label cardinality explosion
    const route = req.route?.path ?? req.path;
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequestTotal.inc(labels);
    end(labels);
  });

  next();
};