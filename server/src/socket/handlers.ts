import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import {
  addUserToBoard,
  removeUserFromBoard,
  getActiveUsers,
} from '../db/redis';
import { executeWrite } from '../db/connection';
import { verifyToken } from '../utils/jwt';

// ================================
// Types
// ================================
interface AuthenticatedSocket extends Socket {
  userId?: number;
  userName?: string;
}

// Track which boards each socket is in (for cleanup on disconnect)
const socketBoards = new Map<string, Set<number>>();

// ================================
// Socket.io Setup
// ================================
export const setupSocketHandlers = (io: Server) => {

  // --------------------------------
  // Authentication middleware
  // Every socket connection must have a valid JWT
  // --------------------------------
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyToken(token);
      socket.userId = payload.userId;
      socket.userName = payload.name;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // --------------------------------
  // Connection Handler
  // --------------------------------
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({ socketId: socket.id, userId: socket.userId }, 'User connected');

    socketBoards.set(socket.id, new Set());

    // --------------------------------
    // Board: Join / Leave
    // --------------------------------
    socket.on('join-board', async ({ boardId }: { boardId: number }) => {
      socket.join(`board:${boardId}`);
      socketBoards.get(socket.id)?.add(boardId);

      // Add to Redis presence
      await addUserToBoard(boardId, socket.userId!, socket.userName!);

      // Send active users list to joining user
      const activeUsers = await getActiveUsers(boardId);
      socket.emit('active-users', { users: activeUsers });

      // Tell everyone else this user joined
      socket.to(`board:${boardId}`).emit('user-joined', {
        user: { id: socket.userId, name: socket.userName },
      });

      logger.info({ userId: socket.userId, boardId }, 'User joined board');
    });

    socket.on('leave-board', async ({ boardId }: { boardId: number }) => {
      socket.leave(`board:${boardId}`);
      socketBoards.get(socket.id)?.delete(boardId);
      await removeUserFromBoard(boardId, socket.userId!);

      socket.to(`board:${boardId}`).emit('user-left', { userId: socket.userId });
    });

    // --------------------------------
    // Cards: Real-time CRUD
    // This is the KEY real-time logic
    // --------------------------------
    socket.on('card-created', async (data: {
      listId: number;
      title: string;
      description?: string;
      boardId: number;
      tempId: string; // Client-generated temp ID for optimistic updates
    }) => {
      try {
        // Get max position in list
        const posResult = await executeWrite(
          'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM cards WHERE list_id = $1',
          [data.listId]
        );
        const position = posResult.rows[0].next_pos;

        // Save to DB
        const result = await executeWrite(
          `INSERT INTO cards (list_id, title, description, position, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [data.listId, data.title, data.description || null, position, socket.userId]
        );

        const card = result.rows[0];

        // Broadcast to ALL users in board room (including sender)
        // Include tempId so client can reconcile optimistic update
        io.to(`board:${data.boardId}`).emit('card-created', {
          card,
          tempId: data.tempId,
          createdBy: { id: socket.userId, name: socket.userName },
        });

      } catch (error) {
        logger.error({ error, data }, 'Failed to create card');
        socket.emit('card-error', {
          type: 'card-created',
          tempId: data.tempId,
          message: 'Failed to create card',
        });
      }
    });

    socket.on('card-updated', async (data: {
      cardId: number;
      title?: string;
      description?: string;
      boardId: number;
    }) => {
      try {
        const result = await executeWrite(
          `UPDATE cards SET
            title = COALESCE($1, title),
            description = COALESCE($2, description),
            updated_at = NOW()
           WHERE id = $3 RETURNING *`,
          [data.title, data.description, data.cardId]
        );

        const card = result.rows[0];
        if (!card) {
          return socket.emit('card-error', {
            type: 'card-updated',
            cardId: data.cardId,
            message: 'Card not found',
          });
        }

        // Broadcast to all except sender (sender already updated optimistically)
        socket.to(`board:${data.boardId}`).emit('card-updated', {
          card,
          updatedBy: { id: socket.userId, name: socket.userName },
        });

      } catch (error) {
        logger.error({ error, data }, 'Failed to update card');
        socket.emit('card-error', {
          type: 'card-updated',
          cardId: data.cardId,
          message: 'Failed to update card',
        });
      }
    });

    socket.on('card-moved', async (data: {
      cardId: number;
      newListId: number;
      newPosition: number;
      oldListId: number;
      oldPosition: number;
      boardId: number;
    }) => {
      try {
        // Update card position in DB
        await executeWrite(
          `UPDATE cards SET list_id = $1, position = $2, updated_at = NOW()
           WHERE id = $3`,
          [data.newListId, data.newPosition, data.cardId]
        );

        // Reorder positions in both lists
        // Shift positions down in old list
        await executeWrite(
          `UPDATE cards SET position = position - 1
           WHERE list_id = $1 AND position > $2 AND id != $3`,
          [data.oldListId, data.oldPosition, data.cardId]
        );

        // Shift positions up in new list
        await executeWrite(
          `UPDATE cards SET position = position + 1
           WHERE list_id = $1 AND position >= $2 AND id != $3`,
          [data.newListId, data.newPosition, data.cardId]
        );

        // Broadcast move to all other users
        socket.to(`board:${data.boardId}`).emit('card-moved', {
          ...data,
          movedBy: { id: socket.userId, name: socket.userName },
        });

      } catch (error) {
        logger.error({ error, data }, 'Failed to move card');
        // Tell sender to rollback optimistic update
        socket.emit('card-move-failed', {
          cardId: data.cardId,
          oldListId: data.oldListId,
          oldPosition: data.oldPosition,
        });
      }
    });

    socket.on('card-deleted', async (data: {
      cardId: number;
      listId: number;
      boardId: number;
    }) => {
      try {
        await executeWrite('DELETE FROM cards WHERE id = $1', [data.cardId]);

        io.to(`board:${data.boardId}`).emit('card-deleted', {
          cardId: data.cardId,
          listId: data.listId,
          deletedBy: { id: socket.userId, name: socket.userName },
        });

      } catch (error) {
        logger.error({ error, data }, 'Failed to delete card');
        socket.emit('card-error', {
          type: 'card-deleted',
          cardId: data.cardId,
          message: 'Failed to delete card',
        });
      }
    });

    // --------------------------------
    // Cursor Tracking (optional feature)
    // --------------------------------
    if (process.env.ENABLE_CURSORS === 'true') {
      socket.on('cursor-move', (data: { boardId: number; x: number; y: number }) => {
        socket.to(`board:${data.boardId}`).emit('cursor-update', {
          userId: socket.userId,
          userName: socket.userName,
          x: data.x,
          y: data.y,
        });
      });
    }

    // --------------------------------
    // Disconnect Cleanup
    // --------------------------------
    socket.on('disconnect', async () => {
      logger.info({ socketId: socket.id, userId: socket.userId }, 'User disconnected');

      const boards = socketBoards.get(socket.id);
      if (boards) {
        for (const boardId of boards) {
          await removeUserFromBoard(boardId, socket.userId!);
          socket.to(`board:${boardId}`).emit('user-left', { userId: socket.userId });
        }
      }

      socketBoards.delete(socket.id);
    });
  });
};