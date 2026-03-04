import { Router, Response } from 'express';
import { z } from 'zod';
import { executeRead, executeWrite } from '../db/connection';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notifyBoardInvite, userSockets, getIo } from '../utils/notifications';

const router = Router();
router.use(authenticate);

// ================================
// POST /api/boards/:boardId/members
// Add a member to a board by email
// ================================
router.post('/:boardId/members', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = parseInt(req.params.boardId);
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if requester is owner or member
    const access = await executeRead(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.userId]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find user by email
    const userResult = await executeRead(
      `SELECT id, name, email FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found with that email' });
    }

    const invitedUser = userResult.rows[0];

    // Check if already a member
    const existingMember = await executeRead(
      `SELECT id FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, invitedUser.id]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this board' });
    }

    // Add member
    await executeWrite(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'member')`,
      [boardId, invitedUser.id]
    );

    // After successfully inserting the board member:
    await notifyBoardInvite(
      invitedUser.id,   // the user being invited
      req.userId!,     // the user doing the inviting
      req.userName!,   // inviter's name (from auth middleware)
      boardId
    ).catch(err => console.error('[Members] Notification error:', err));

    res.status(201).json({
      member: {
        id: invitedUser.id,
        name: invitedUser.name,
        email: invitedUser.email,
        role: 'member',
      },
      message: `${invitedUser.name} added to board`,
    });
  } catch (error) {
    console.error('[Members API] Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// ================================
// DELETE /api/boards/:boardId/members/:userId
// Remove a member from a board
// ================================
router.delete('/:boardId/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = parseInt(req.params.boardId);
    const userIdToRemove = parseInt(req.params.userId);

    // Check if requester is owner
    const board = await executeRead(
      `SELECT owner_id FROM boards WHERE id = $1`,
      [boardId]
    );

    if (board.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    if (board.rows[0].owner_id !== req.userId) {
      return res.status(403).json({ error: 'Only the board owner can remove members' });
    }

    // Can't remove the owner
    if (userIdToRemove === req.userId) {
      return res.status(400).json({ error: 'Cannot remove the board owner' });
    }

    await executeWrite(
      `DELETE FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, userIdToRemove]
    );

    // Push board-removed directly to the removed user's socket(s)
    // so their dashboard updates instantly without a refresh
    const io = getIo()
    if (io) {
      const sockets = userSockets.get(userIdToRemove)
      if (sockets && sockets.size > 0) {
        for (const socketId of sockets) {
          io.to(socketId).emit('board-removed', { boardId })
        }
      }
    }

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('[Members API] Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;