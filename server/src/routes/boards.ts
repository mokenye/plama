import { Router, Response } from 'express';
import { z } from 'zod';
import { executeRead, executeWrite } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { transformBoard, transformList, transformCard, transformMember } from '../utils/transform';
import { getIo } from '../utils/notifications';
import { logger } from '../utils/logger';

const router = Router();

// All board routes require auth
router.use(authenticate);

const boardSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  background_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
});

// --------------------------------
// GET /api/boards - Get all boards user has access to
// --------------------------------
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await executeRead(
      `SELECT b.*, u.name AS owner_name,
              bm.role AS user_role,
              (SELECT COUNT(*) FROM board_members WHERE board_id = b.id) AS member_count
       FROM boards b
       JOIN users u ON b.owner_id = u.id
       JOIN board_members bm ON b.id = bm.board_id AND bm.user_id = $1
       ORDER BY b.updated_at DESC`,
      [req.userId]
    );

    res.json({ boards: result.rows.map(transformBoard) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// --------------------------------
// POST /api/boards - Create a board
// --------------------------------
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parsed = boardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { title, description, background_color } = parsed.data;

    // Create board
    const boardResult = await executeWrite(
      `INSERT INTO boards (title, description, owner_id, background_color)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description || null, req.userId, background_color || '#6366F1']
    );

    const board = boardResult.rows[0];

    // Add creator as owner member
    await executeWrite(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [board.id, req.userId]
    );

    // Create default lists
    const defaultLists = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaultLists.length; i++) {
      await executeWrite(
        `INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3)`,
        [board.id, defaultLists[i], i + 1]
      );
    }

    res.status(201).json({ board });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// --------------------------------
// GET /api/boards/:id - Get full board with lists and cards
// --------------------------------
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = parseInt(req.params.id);

    // Check access
    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get board
    const boardResult = await executeRead(
      `SELECT b.*, u.name AS owner_name
       FROM boards b JOIN users u ON b.owner_id = u.id
       WHERE b.id = $1`,
      [boardId]
    );

    if (boardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Get lists
    const listsResult = await executeRead(
      `SELECT * FROM lists WHERE board_id = $1 ORDER BY position`,
      [boardId]
    );

    // Get cards for all lists
    const cardsResult = await executeRead(
      `SELECT c.*, u.name AS created_by_name
       FROM cards c
       JOIN lists l ON c.list_id = l.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE l.board_id = $1
       ORDER BY c.list_id, c.position`,
      [boardId]
    );

    // Get members
    const membersResult = await executeRead(
      `SELECT u.id, u.name, u.email, u.avatar_url, bm.role
       FROM board_members bm JOIN users u ON bm.user_id = u.id
       WHERE bm.board_id = $1`,
      [boardId]
    );

    res.json({
      board: transformBoard(boardResult.rows[0]),
      lists: listsResult.rows.map(transformList),
      cards: cardsResult.rows.map(transformCard),
      members: membersResult.rows.map(transformMember),
      userRole: access.rows[0].role,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// --------------------------------
// PATCH /api/boards/:id
// Update board title and/or color
// --------------------------------
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = parseInt(req.params.id);
    const { title, background_color } = req.body;

    // Check access — owner only
    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (access.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only the board owner can update board settings' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }

    if (background_color !== undefined) {
      updates.push(`background_color = $${paramCount++}`);
      values.push(background_color);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(boardId);

    const result = await executeWrite(
      `UPDATE boards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    const board = transformBoard(result.rows[0]);

    // Broadcast to all users currently viewing this board
    const io = getIo()
    if (io) {
      io.to(`board:${boardId}`).emit('board-updated', {
        boardId,
        title: board.title,
        backgroundColor: board.backgroundColor,
      })
    }

    res.json({ board });
  } catch (error) {
    logger.error({ error }, '[Boards API] Update error');
    res.status(500).json({ error: 'Failed to update board' });
  }
});

// --------------------------------
// DELETE /api/boards/:id
// --------------------------------
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = parseInt(req.params.id);

    // Only owner can delete
    const board = await executeRead(
      `SELECT owner_id FROM boards WHERE id = $1`,
      [boardId]
    );

    if (board.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.rows[0].owner_id !== req.userId) {
      return res.status(403).json({ error: 'Only the board owner can delete it' });
    }

    await executeWrite('DELETE FROM boards WHERE id = $1', [boardId]);

    res.json({ message: 'Board deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

export default router;