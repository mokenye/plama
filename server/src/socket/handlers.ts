import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { transformCard } from '../utils/transform';
import { logActivity } from '../utils/activityLogger';
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

// In-memory presence fallback (when Redis isn't available)
const inMemoryPresence = new Map<number, Map<number, { id: number; name: string; joinedAt: number }>>();

const addUserToPresence = async (boardId: number, userId: number, userName: string) => {
  try {
    await addUserToBoard(boardId, userId, userName);
  } catch {
    // Fallback to in-memory
    if (!inMemoryPresence.has(boardId)) {
      inMemoryPresence.set(boardId, new Map());
    }
    inMemoryPresence.get(boardId)!.set(userId, { id: userId, name: userName, joinedAt: Date.now() });
  }
};

const removeUserFromPresence = async (boardId: number, userId: number) => {
  try {
    await removeUserFromBoard(boardId, userId);
  } catch {
    // Fallback to in-memory
    inMemoryPresence.get(boardId)?.delete(userId);
  }
};

const getActiveUsersFromPresence = async (boardId: number): Promise<any[]> => {
  try {
    return await getActiveUsers(boardId);
  } catch {
    // Fallback to in-memory
    const users = inMemoryPresence.get(boardId);
    return users ? Array.from(users.values()) : [];
  }
};

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

      // Add to presence tracking
      await addUserToPresence(boardId, socket.userId!, socket.userName!);

      // Send active users list to joining user
      const activeUsers = await getActiveUsersFromPresence(boardId);
      logger.info({ boardId, activeUsersCount: activeUsers.length, userId: socket.userId }, 'User joined board');
      socket.emit('active-users', { users: activeUsers });

      // Tell everyone else this user joined
      socket.to(`board:${boardId}`).emit('user-joined', {
        user: { id: socket.userId, name: socket.userName },
      });
    });

    socket.on('leave-board', async ({ boardId }: { boardId: number }) => {
      socket.leave(`board:${boardId}`);
      socketBoards.get(socket.id)?.delete(boardId);
      await removeUserFromPresence(boardId, socket.userId!);

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

        const dbCard = result.rows[0];
        
        // Transform to camelCase for frontend
        const card = transformCard(dbCard);

        // Log activity
        await logActivity({
          boardId: data.boardId,
          userId: socket.userId!,
          userName: socket.userName!,
          action: 'card_created',
          entityType: 'card',
          entityId: card.id,
          entityName: card.title,
        });

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
      dueDate?: string | null;
      labels?: string[];
      assignees?: number[];
      boardId: number;
    }) => {
      try {
        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (data.title !== undefined) {
          updates.push(`title = $${paramCount++}`);
          values.push(data.title);
        }
        if (data.description !== undefined) {
          updates.push(`description = $${paramCount++}`);
          values.push(data.description);
        }
        if (data.dueDate !== undefined) {
          updates.push(`due_date = $${paramCount++}`);
          values.push(data.dueDate);
        }
        if (data.labels !== undefined) {
          updates.push(`labels = $${paramCount++}`);
          values.push(data.labels);
        }
        if (data.assignees !== undefined) {
          updates.push(`assignees = $${paramCount++}`);
          values.push(data.assignees);
        }

        updates.push(`updated_at = NOW()`);
        values.push(data.cardId);

        const result = await executeWrite(
          `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
          values
        );

        const dbCard = result.rows[0];
        if (!dbCard) {
          return socket.emit('card-error', {
            type: 'card-updated',
            cardId: data.cardId,
            message: 'Card not found',
          });
        }

        // Transform to camelCase
        const card = transformCard(dbCard);

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
        // Get card title and list names for activity log
        const cardResult = await executeWrite(
          'SELECT title FROM cards WHERE id = $1',
          [data.cardId]
        );
        const cardTitle = cardResult.rows[0]?.title || 'Card';

        const listsResult = await executeWrite(
          'SELECT id, title FROM lists WHERE id = ANY($1)',
          [[data.oldListId, data.newListId]]
        );
        const listMap = new Map(listsResult.rows.map((l: any) => [l.id, l.title]));
        const oldListTitle = listMap.get(data.oldListId) || 'List';
        const newListTitle = listMap.get(data.newListId) || 'List';

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

        // Log activity
        await logActivity({
          boardId: data.boardId,
          userId: socket.userId!,
          userName: socket.userName!,
          action: 'card_moved',
          entityType: 'card',
          entityId: data.cardId,
          entityName: cardTitle,
          metadata: {
            fromList: oldListTitle,
            toList: newListTitle,
          },
        });

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
        // Get card title before deleting
        const cardResult = await executeWrite(
          'SELECT title FROM cards WHERE id = $1',
          [data.cardId]
        );
        const cardTitle = cardResult.rows[0]?.title || 'Card';

        await executeWrite('DELETE FROM cards WHERE id = $1', [data.cardId]);

        // Log activity
        await logActivity({
          boardId: data.boardId,
          userId: socket.userId!,
          userName: socket.userName!,
          action: 'card_deleted',
          entityType: 'card',
          entityId: data.cardId,
          entityName: cardTitle,
        });

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

    socket.on('list-deleted', async (data: {
      listId: number;
      boardId: number;
    }) => {
      try {
        // Delete all cards in the list first (CASCADE should handle this, but being explicit)
        await executeWrite('DELETE FROM cards WHERE list_id = $1', [data.listId]);
        
        // Get list title before deleting
        const listResult = await executeWrite(
          'SELECT title FROM lists WHERE id = $1',
          [data.listId]
        );
        const listTitle = listResult.rows[0]?.title || 'List';
        
        // Delete the list
        await executeWrite('DELETE FROM lists WHERE id = $1', [data.listId]);

        // Log activity
        await logActivity({
          boardId: data.boardId,
          userId: socket.userId!,
          userName: socket.userName!,
          action: 'list_deleted',
          entityType: 'list',
          entityId: data.listId,
          entityName: listTitle,
        });

        io.to(`board:${data.boardId}`).emit('list-deleted', {
          listId: data.listId,
          deletedBy: { id: socket.userId, name: socket.userName },
        });

      } catch (error) {
        logger.error({ error, data }, 'Failed to delete list');
        socket.emit('list-error', {
          type: 'list-deleted',
          listId: data.listId,
          message: 'Failed to delete list',
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
          await removeUserFromPresence(boardId, socket.userId!);
          
          const activeUsers = await getActiveUsersFromPresence(boardId);
          socket.to(`board:${boardId}`).emit('active-users', { users: activeUsers });
        }
      }

      socketBoards.delete(socket.id);
    });
  });
};