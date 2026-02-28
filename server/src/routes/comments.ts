import { Router, Response } from 'express';
import { executeRead, executeWrite } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/cards/:cardId/comments
router.get('/:cardId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const cardId = parseInt(req.params.cardId);

    const result = await executeRead(
      `SELECT c.*, u.name as user_name 
       FROM card_comments c 
       JOIN users u ON c.user_id = u.id 
       WHERE c.card_id = $1 
       ORDER BY c.created_at ASC`,
      [cardId]
    );

    const comments = result.rows.map((row: any) => ({
      id: row.id,
      cardId: row.card_id,
      userId: row.user_id,
      userName: row.user_name,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ comments });
  } catch (error) {
    console.error('[Comments API] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/cards/:cardId/comments
router.post('/:cardId/comments', async (req: AuthRequest, res: Response) => {
  try {
    const cardId = parseInt(req.params.cardId);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const result = await executeWrite(
      `INSERT INTO card_comments (card_id, user_id, content) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [cardId, req.userId, content.trim()]
    );

    const userResult = await executeRead(
      'SELECT name FROM users WHERE id = $1',
      [req.userId]
    );

    const comment = {
      id: result.rows[0].id,
      cardId: result.rows[0].card_id,
      userId: result.rows[0].user_id,
      userName: userResult.rows[0].name,
      content: result.rows[0].content,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
    };

    res.status(201).json({ comment });
  } catch (error) {
    console.error('[Comments API] Create error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// DELETE /api/cards/:cardId/comments/:commentId
router.delete('/:cardId/comments/:commentId', async (req: AuthRequest, res: Response) => {
  try {
    const commentId = parseInt(req.params.commentId);

    // Check if user owns the comment
    const check = await executeRead(
      'SELECT user_id FROM card_comments WHERE id = $1',
      [commentId]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (check.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Can only delete your own comments' });
    }

    await executeWrite('DELETE FROM card_comments WHERE id = $1', [commentId]);

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('[Comments API] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;