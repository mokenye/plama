import { Router, Response } from 'express';
import { executeRead } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// NOTE: Card mutations (create, update, move, delete) happen via WebSocket
// for real-time sync. These REST routes are for initial data loading only.

// --------------------------------
// GET /api/boards/:boardId/cards/:cardId - Get single card detail
// --------------------------------
router.get('/:boardId/cards/:cardId', async (req: AuthRequest, res: Response) => {
  try {
    const { boardId, cardId } = req.params;

    // Check access
    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );
    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await executeRead(
      `SELECT c.*, u.name AS created_by_name, l.board_id
       FROM cards c
       JOIN lists l ON c.list_id = l.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1 AND l.board_id = $2`,
      [cardId, boardId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    res.json({ card: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

export default router;