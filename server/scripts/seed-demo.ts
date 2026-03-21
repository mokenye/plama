import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import { executeRead, executeWrite } from '../src/db/connection';
import { signToken } from '../src/utils/jwt';

const DEFAULT_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
const DEFAULT_NAME = process.env.DEMO_NAME || 'Demo User';
const DEFAULT_PASSWORD = process.env.DEMO_PASSWORD || 'password123';

const seed = async () => {
  try {
    // Check for existing user
    const existing = await executeRead('SELECT id, name, email FROM users WHERE email = $1', [DEFAULT_EMAIL]);
    let user: any;

    if (existing.rows.length > 0) {
      user = existing.rows[0];
      console.log('Found existing demo user:', user.email);
    } else {
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10); // use 4 or 10 rounds for faster seeding in development, 12 in production
      const res = await executeWrite(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email`,
        [DEFAULT_NAME, DEFAULT_EMAIL, passwordHash]
      );
      user = res.rows[0];
      console.log('Created demo user:', user.email);
    }

    // Create a board for the demo user
    const boardRes = await executeWrite(
      `INSERT INTO boards (title, description, owner_id, background_color) VALUES ($1, $2, $3, $4) RETURNING id, title`,
      ['Demo Board', 'Seeded demo board', user.id, '#6366F1']
    );
    const board = boardRes.rows[0];

    // Add creator as owner member (ignore conflict)
    await executeWrite(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
      [board.id, user.id]
    );

    // Create default lists
    const defaultLists = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaultLists.length; i++) {
      await executeWrite(
        `INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [board.id, defaultLists[i], i + 1]
      );
    }

    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    console.log('\n=== Demo seed complete ===');
    console.log('email:', user.email);
    console.log('password:', DEFAULT_PASSWORD);
    console.log('boardId:', board.id);
    console.log('token (use in localStorage key "token"):\n', token);
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

seed();