import dotenv from 'dotenv';
dotenv.config();

import { writePool, schema } from './connection';
import { logger } from '../utils/logger';

const migrate = async () => {
  try {
    logger.info('Running database migrations...');
    await writePool.query(schema);
    logger.info('✅ Migrations complete');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();