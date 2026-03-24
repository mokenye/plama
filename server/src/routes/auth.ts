import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { executeRead, executeWrite } from '../db/connection';
import { signToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// --------------------------------
// Input Validation Schemas
// --------------------------------
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --------------------------------
// POST /api/auth/register
// --------------------------------
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { name, email, password } = parsed.data;

    // Check if email exists
    const existing = await executeRead(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10); // 10 salt rounds is a good balance for security and performance. 12 is more secure but can be slower, especially on free-tier hosting. Adjust as needed based on your environment and load testing results.

    // Create user
    const result = await executeWrite(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// --------------------------------
// POST /api/auth/login
// --------------------------------
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const { email, password } = parsed.data;

    const result = await executeRead(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Rehash from 12 to 10 rounds for performance
    if (user.password_hash.startsWith('$2b$12$')) {
      const fasterHash = await bcrypt.hash(password, 10);
      await executeWrite(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [fasterHash, user.id]
      );
    }

    const token = signToken({ userId: user.id, email: user.email, name: user.name });

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --------------------------------
// GET /api/auth/me
// --------------------------------
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await executeRead(
      'SELECT id, name, email, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;