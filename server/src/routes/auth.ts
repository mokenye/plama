import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { executeRead, executeWrite } from '../db/connection';
import { signToken, verifyToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateGuestName } from '../utils/guestName';

const router = Router();
const googleClient = new OAuth2Client();

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

const publicUser = (row: {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  created_at?: string;
  is_guest?: boolean;
}) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  avatarUrl: row.avatar_url || undefined,
  createdAt: row.created_at,
  isGuest: !!row.is_guest,
});

const issueToken = (user: { id: number; email: string; name: string; is_guest?: boolean }) =>
  signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    ...(user.is_guest ? { isGuest: true } : {}),
  });

const getGuestUserId = async (req: Request): Promise<number | null> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = verifyToken(authHeader.split(' ')[1]);
    if (!payload.isGuest) return null;
    const result = await executeRead(
      'SELECT id FROM users WHERE id = $1 AND is_guest = TRUE',
      [payload.userId]
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
};

const deleteGuestUser = async (guestId: number | null) => {
  if (!guestId) return;
  await executeWrite('DELETE FROM users WHERE id = $1 AND is_guest = TRUE', [guestId]);
};

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
    const guestId = await getGuestUserId(req);

    // Check if email exists (ignore the current guest row so it can be converted)
    const existing = await executeRead(
      'SELECT id FROM users WHERE email = $1 AND id != COALESCE($2, 0)',
      [email, guestId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10); // 10 salt rounds is a good balance for security and performance. 12 is more secure but can be slower, especially on free-tier hosting. Adjust as needed based on your environment and load testing results.

    let user;
    if (guestId) {
      const result = await executeWrite(
        `UPDATE users
         SET name = $1, email = $2, password_hash = $3, is_guest = FALSE, auth_provider = 'local', updated_at = NOW()
         WHERE id = $4 AND is_guest = TRUE
         RETURNING id, name, email, avatar_url, created_at, is_guest`,
        [name, email, passwordHash, guestId]
      );
      user = result.rows[0];
    }

    if (!user) {
      const result = await executeWrite(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, avatar_url, created_at, is_guest`,
        [name, email, passwordHash]
      );
      user = result.rows[0];
    }

    const token = issueToken(user);

    res.status(201).json({ user: publicUser(user), token });
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
      'SELECT id, name, email, password_hash, is_guest FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
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

    const guestId = await getGuestUserId(req);
    if (guestId && guestId !== user.id) {
      await deleteGuestUser(guestId);
    }

    const token = issueToken(user);

    res.json({
      user: publicUser(user),
      token,
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --------------------------------
// POST /api/auth/google
// --------------------------------
const googleSchema = z.object({
  credential: z.string().min(1),
});

router.post('/google', async (req: Request, res: Response) => {
  try {
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Missing Google credential' });
    }

    const { credential } = parsed.data;

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { sub: googleId, email, name: googleName, picture } = payload;
    const displayName = googleName || email.split('@')[0];

    // Check if user already exists (by google_id or email)
    let user = (await executeRead(
      'SELECT id, name, email, avatar_url, google_id, is_guest FROM users WHERE google_id = $1',
      [googleId]
    )).rows[0];

    if (!user) {
      // Check if an email-based account already exists (link it)
      user = (await executeRead(
        'SELECT id, name, email, avatar_url, google_id, is_guest FROM users WHERE email = $1 AND is_guest = FALSE',
        [email]
      )).rows[0];

      if (user && !user.google_id) {
        // Link Google to existing email account
        await executeWrite(
          'UPDATE users SET google_id = $1, auth_provider = CASE WHEN auth_provider = \'local\' THEN \'both\' ELSE auth_provider END, avatar_url = COALESCE(avatar_url, $2) WHERE id = $3',
          [googleId, picture || null, user.id]
        );
      } else if (!user) {
        const guestId = await getGuestUserId(req);
        if (guestId) {
          const converted = await executeWrite(
            `UPDATE users
             SET name = $1, email = $2, google_id = $3, avatar_url = COALESCE(avatar_url, $4),
                 auth_provider = 'google', is_guest = FALSE, updated_at = NOW()
             WHERE id = $5 AND is_guest = TRUE
             RETURNING id, name, email, avatar_url, is_guest`,
            [displayName, email, googleId, picture || null, guestId]
          );
          user = converted.rows[0];
        }
        if (!user) {
          const result = await executeWrite(
            `INSERT INTO users (name, email, google_id, avatar_url, auth_provider)
             VALUES ($1, $2, $3, $4, 'google')
             RETURNING id, name, email, avatar_url, is_guest`,
            [displayName, email, googleId, picture || null]
          );
          user = result.rows[0];
        }
      }
    }

    if (!user) {
      return res.status(500).json({ error: 'Google authentication failed' });
    }

    const leftoverGuestId = await getGuestUserId(req);
    if (leftoverGuestId && leftoverGuestId !== user.id) {
      await deleteGuestUser(leftoverGuestId);
    }

    const token = issueToken({
      id: user.id,
      email: user.email || email,
      name: user.name || displayName,
      is_guest: user.is_guest,
    });

    res.json({
      user: publicUser({
        ...user,
        email: user.email || email,
        name: user.name || displayName,
      }),
      token,
    });
  } catch (error: any) {
    if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
      return res.status(401).json({ error: 'Google token expired or invalid' });
    }
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// --------------------------------
// POST /api/auth/guest
// Creates a guest session so visitors can use the app without signing up
// --------------------------------
router.post('/guest', async (_req: Request, res: Response) => {
  try {
    const name = generateGuestName();
    const email = `guest.${randomUUID()}@plama.local`;
    const result = await executeWrite(
      `INSERT INTO users (name, email, is_guest, auth_provider)
       VALUES ($1, $2, TRUE, 'guest')
       RETURNING id, name, email, avatar_url, created_at, is_guest`,
      [name, email]
    );

    const user = result.rows[0];
    const token = issueToken(user);

    res.status(201).json({ user: publicUser(user), token });
  } catch (error) {
    res.status(500).json({ error: 'Could not start guest session' });
  }
});

// --------------------------------
// GET /api/auth/me
// --------------------------------
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await executeRead(
      'SELECT id, name, email, avatar_url, created_at, is_guest FROM users WHERE id = $1',
      [req.userId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;