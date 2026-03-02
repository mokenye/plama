import { Router, Response } from 'express';
import { executeRead } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/boards/:boardId/activity - Get recent activity for a board
router.get('/:boardId/activity', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = parseInt(req.params.boardId);
    const limit = parseInt(req.query.limit as string) || 50;

    // Check access
    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch recent activity
    const result = await executeRead(
      `SELECT * FROM board_activity 
       WHERE board_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [boardId, limit]
    );

    const activities = result.rows.map((row: any) => ({
      id: row.id,
      boardId: row.board_id,
      userId: row.user_id,
      userName: row.user_name,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      metadata: row.metadata,
      createdAt: row.created_at,
      
    }));

    res.json({ activities });
  } catch (error) {
    console.error('[Activity API] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

export default router;