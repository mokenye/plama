import { Router, Response } from 'express';
import { executeRead, executeWrite } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/notifications - Get user's notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unread === 'true';

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;

    if (unreadOnly) {
      query += ` AND read = FALSE`;
    }

    query += ` ORDER BY created_at DESC LIMIT $2`;

    const result = await executeRead(query, [req.userId, limit]);

    const notifications = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      boardId: row.board_id,
      cardId: row.card_id,
      type: row.type,
      title: row.title,
      message: row.message,
      read: row.read,
      link: row.link,
      createdAt: row.created_at,
    }));

    res.json({ notifications });
  } catch (error) {
    console.error('[Notifications API] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const result = await executeRead(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = $1 AND read = FALSE`,
      [req.userId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('[Notifications API] Count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// PATCH /api/notifications/:id/read - Mark as read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);

    await executeWrite(
      `UPDATE notifications 
       SET read = TRUE 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications API] Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    await executeWrite(
      `UPDATE notifications 
       SET read = TRUE 
       WHERE user_id = $1 AND read = FALSE`,
      [req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications API] Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);

    await executeWrite(
      `DELETE FROM notifications 
       WHERE id = $1 AND user_id = $2`,
      [notificationId, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[Notifications API] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

export default router;