import { Router, Response } from 'express';
import { z } from 'zod';
import { executeRead, executeWrite } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { transformList } from '../utils/transform';

const router = Router();
router.use(authenticate);

const listSchema = z.object({
  title: z.string().min(1).max(255),
});

// --------------------------------
// POST /api/boards/:boardId/lists
// --------------------------------
router.post('/:boardId/lists', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = parseInt(req.params.boardId);
    console.log('[Lists API] Creating list for board:', boardId, 'Title:', req.body.title, 'User:', req.userId);

    // Check access
    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );
    if (access.rows.length === 0) {
      console.log('[Lists API] Access denied for user:', req.userId, 'board:', boardId);
      return res.status(403).json({ error: 'Access denied' });
    }

    const parsed = listSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    // Get next position
    const posResult = await executeWrite(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM lists WHERE board_id = $1`,
      [boardId]
    );

    const result = await executeWrite(
      `INSERT INTO lists (board_id, title, position) VALUES ($1, $2, $3) RETURNING *`,
      [boardId, parsed.data.title, posResult.rows[0].next_pos]
    );

    console.log('[Lists API] List created successfully:', result.rows[0]);
    res.status(201).json({ list: transformList(result.rows[0]) });
  } catch (error) {
    console.error('[Lists API] Error creating list:', error);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// --------------------------------
// PATCH /api/boards/:boardId/lists/:listId
// --------------------------------
router.patch('/:boardId/lists/:listId', async (req: AuthRequest, res: Response) => {
  try {
    const { boardId, listId } = req.params;

    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );
    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const parsed = listSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const result = await executeWrite(
      `UPDATE lists SET title = $1 WHERE id = $2 AND board_id = $3 RETURNING *`,
      [parsed.data.title, listId, boardId]
    );

    res.json({ list: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// --------------------------------
// POST /api/boards/:boardId/lists/:listId/reorder
// --------------------------------
router.post('/:boardId/lists/:listId/reorder', async (req: AuthRequest, res: Response) => {
  try {
    const { boardId, listId } = req.params;
    const { cardIds } = req.body;

    if (!Array.isArray(cardIds) || cardIds.some((id) => typeof id !== 'number')) {
      return res.status(400).json({ error: 'cardIds must be an array of numbers' });
    }

    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );
    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update each card's position based on its index in cardIds
    for (let i = 0; i < cardIds.length; i++) {
      await executeWrite(
        `UPDATE cards SET position = $1 WHERE id = $2 AND list_id = $3`,
        [i + 1, cardIds[i], listId]
      );
    }

    res.json({ message: 'Cards reordered' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder cards' });
  }
});

// --------------------------------
// DELETE /api/boards/:boardId/lists/:listId
// --------------------------------
router.delete('/:boardId/lists/:listId', async (req: AuthRequest, res: Response) => {
  try {
    const { boardId, listId } = req.params;

    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );
    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await executeWrite(
      `DELETE FROM lists WHERE id = $1 AND board_id = $2`,
      [listId, boardId]
    );

    res.json({ message: 'List deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

export default router;