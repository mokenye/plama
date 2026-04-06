import { createClient } from 'redis';
import { logger } from '../utils/logger';
import { redisPresenceOps } from '../metrics';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

client.on('error', (err) => logger.error('Redis error:', err));
client.on('connect', () => logger.info('✅ Redis connected'));
client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

export const connectRedis = async () => {
  try {
    if (!client.isOpen) {
      await client.connect();
    } else {
      logger.info('✅ Redis already connected');
    }
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    // Don't crash - app can run without Redis (just no presence tracking)
    logger.warn('Running without Redis - presence tracking disabled');
  }
};

export const redis = client;

// ================================
// Presence Helpers
// Tracks who is online on each board
// ================================
export const addUserToBoard = async (boardId: number, userId: number, userName: string) => {
  try {
    await client.hSet(`board:${boardId}:users`, userId.toString(), JSON.stringify({
      id: userId,
      name: userName,
      joinedAt: Date.now(),
    }));
    await client.expire(`board:${boardId}:users`, 3600); // 1 hour TTL
    redisPresenceOps.inc({ result: 'hit' });
  } catch (error) {
    redisPresenceOps.inc({ result: 'error' });
    logger.error('Redis presence error (addUserToBoard):', error);
  }
};

export const removeUserFromBoard = async (boardId: number, userId: number) => {
  try {
    await client.hDel(`board:${boardId}:users`, userId.toString());
    redisPresenceOps.inc({ result: 'hit' });
  } catch (error) {
    redisPresenceOps.inc({ result: 'error' });
    logger.error('Redis presence error (removeUserFromBoard):', error);
  }
};

export const getActiveUsers = async (boardId: number) => {
  try {
    const users = await client.hGetAll(`board:${boardId}:users`);
    redisPresenceOps.inc({ result: 'hit' });
    return Object.values(users).map((u) => JSON.parse(u));
  } catch (error) {
    redisPresenceOps.inc({ result: 'error' });
    logger.error('Redis presence error (getActiveUsers):', error);
    return [];
  }
};

// ================================
// Cache Helpers
// Structured for easy enable/disable via env flag
// ================================
export const cacheGet = async (key: string) => {
  if (process.env.ENABLE_CACHING !== 'true') return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (key: string, value: any, ttlSeconds = 300) => {
  if (process.env.ENABLE_CACHING !== 'true') return;
  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Cache failure is non-critical
  }
};

export const cacheDelete = async (key: string) => {
  try {
    await client.del(key);
  } catch {
    // Non-critical
  }
};