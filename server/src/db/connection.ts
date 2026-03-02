import { Pool } from 'pg';
// import pg from 'pg';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
dotenv.config();

// Force pg to return timestamps as strings instead of converting to local time
// pg.types.setTypeParser(1114, (str) => str + 'Z'); // TIMESTAMP
// pg.types.setTypeParser(1184, (str) => str);        // TIMESTAMPTZ

// ================================
// Connection Pools
// ================================

// Primary (write) pool
export const writePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
  ? { rejectUnauthorized: false }
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,                // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Read pool (same DB for now - swap to replica via env var when scaling)
export const readPool = new Pool({
  connectionString: process.env.USE_READ_REPLICAS === 'true'
    ? process.env.DATABASE_READ_URL  // replica
    : process.env.DATABASE_URL,      // same DB (current)
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
  ? { rejectUnauthorized: false }
  : process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ================================
// Query Helpers
// Separating reads/writes now means easy replica swap later
// ================================
export const executeRead = async (query: string, params: any[] = []) => {
  const start = Date.now();
  try {
    const result = await readPool.query(query, params);
    logger.debug({ query, duration: Date.now() - start, rows: result.rowCount }, 'DB read');
    return result;
  } catch (error) {
    logger.error({ query, error }, 'DB read error');
    throw error;
  }
};

export const executeWrite = async (query: string, params: any[] = []) => {
  const start = Date.now();
  try {
    const result = await writePool.query(query, params);
    logger.debug({ query, duration: Date.now() - start, rows: result.rowCount }, 'DB write');
    return result;
  } catch (error) {
    logger.error({ query, error }, 'DB write error');
    throw error;
  }
};

// ================================
// Health Check
// ================================
export const testDatabaseConnection = async () => {
  try {
    await writePool.query('SELECT NOW()');
    logger.info('✅ Database connected successfully');
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// ================================
// Schema (Run once to set up DB)
// ================================
export const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    created_at TIMESTAMPZ DEFAULT NOW(),
    updated_at TIMESTAMPZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS boards (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    background_color VARCHAR(7) DEFAULT '#0052CC',
    created_at TIMESTAMPZ DEFAULT NOW(),
    updated_at TIMESTAMPZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS board_members (
    id SERIAL PRIMARY KEY,
    board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPZ DEFAULT NOW(),
    UNIQUE(board_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS lists (
    id SERIAL PRIMARY KEY,
    board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL,
    created_by INTEGER REFERENCES users(id),
    due_date TIMESTAMPZ,
    created_at TIMESTAMPZ DEFAULT NOW(),
    updated_at TIMESTAMPZ DEFAULT NOW()
  );

  -- Performance indexes
  CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
  CREATE INDEX IF NOT EXISTS idx_board_members_board ON board_members(board_id);
  CREATE INDEX IF NOT EXISTS idx_board_members_user ON board_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_lists_board ON lists(board_id);
  CREATE INDEX IF NOT EXISTS idx_lists_position ON lists(board_id, position);
  CREATE INDEX IF NOT EXISTS idx_cards_list ON cards(list_id);
  CREATE INDEX IF NOT EXISTS idx_cards_position ON cards(list_id, position);
`;