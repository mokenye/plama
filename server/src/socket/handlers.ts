import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { transformCard } from '../utils/transform';
import { logActivity } from '../utils/activityLogger';
import {
  wsEventsTotal,
  wsEventDuration,
  wsBoardRoomSize,
  optimisticRollbacks,
  cardMovesTotal,
  redisPresenceOps,
} from '../metrics';
import {
  addUserToBoard,
  removeUserFromBoard,
  getActiveUsers,
} from '../db/redis';
import { executeWrite, executeTransaction } from '../db/connection';
import { verifyToken } from '../utils/jwt';
import { notifyCardAssignment, notifyCardComment, notifyCardMoved, registerUserSocket, unregisterUserSocket } from '../utils/notifications';
import { Client } from 'pg';

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
    redisPresenceOps.inc({ result: 'fallback' });
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
    redisPresenceOps.inc({ result: 'fallback' });
    // Fallback to in-memory
    inMemoryPresence.get(boardId)?.delete(userId);
  }
};

const getActiveUsersFromPresence = async (boardId: number): Promise<any[]> => {
  try {
    return await getActiveUsers(boardId);
  } catch {
    redisPresenceOps.inc({ result: 'fallback' });
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

    // Register for targeted events (notifications, board-invited, board-removed)
    if (socket.userId) {
      registerUserSocket(socket.userId, socket.id);
      // Join personal room — enables reliable targeted emits without userSockets map
      socket.join(`user:${socket.userId}`);
    }

    // --------------------------------
    // Board: Join / Leave
    // --------------------------------
    socket.on('join-board', async ({ boardId }: { boardId: number }) => {
      wsEventsTotal.inc({ event: 'join-board' });
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
      wsEventsTotal.inc({ event: 'leave-board' });
      socket.leave(`board:${boardId}`);
      socketBoards.get(socket.id)?.delete(boardId);
      await removeUserFromPresence(boardId, socket.userId!);

      socket.to(`board:${boardId}`).emit('user-left', { userId: socket.userId });
    });

    socket.on('user-away', ({ boardId }) => {
      socket.to(`board:${boardId}`).emit('user-away', { userId: socket.userId });
    });

    socket.on('user-active', ({ boardId }) => {
      socket.to(`board:${boardId}`).emit('user-active', { userId: socket.userId });
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
      wsEventsTotal.inc({ event: 'card-created' });
      const endTimer = wsEventDuration.startTimer({ event: 'card-created' });
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
        optimisticRollbacks.inc({ event: 'card-created' });
        logger.error({ error, data }, 'Failed to create card');
        socket.emit('card-error', {
          type: 'card-created',
          tempId: data.tempId,
          message: 'Failed to create card',
        });
      } finally {
        endTimer();
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
      wsEventsTotal.inc({ event: 'card-updated' });
      const endTimer = wsEventDuration.startTimer({ event: 'card-updated' });
      try {
        // Fetch old assignees BEFORE the update so we can diff them
        const oldCardResult = await executeWrite(
          'SELECT assignees FROM cards WHERE id = $1',
          [data.cardId]
        );
        const oldAssignees: number[] = oldCardResult.rows[0]?.assignees || [];

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
          `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *, (SELECT name FROM users WHERE id = created_by) AS created_by_name`,
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

        // Notify newly added assignees
        if (data.assignees !== undefined) {
          const newAssignees: number[] = dbCard.assignees || [];
          const addedAssignees = newAssignees.filter((id: number) => !oldAssignees.includes(id));

          for (const assigneeId of addedAssignees) {
            await notifyCardAssignment(
              assigneeId,
              socket.userId!,
              socket.userName!,
              data.boardId,
              card.id,
              card.title
            );
          }
        }

        // Broadcast to all except sender (sender already updated optimistically)
        socket.to(`board:${data.boardId}`).emit('card-updated', {
          card,
          updatedBy: { id: socket.userId, name: socket.userName },
        });

      } catch (error) {
        optimisticRollbacks.inc({ event: 'card-updated' });
        logger.error({ error, data }, 'Failed to update card');
        socket.emit('card-error', {
          type: 'card-updated',
          cardId: data.cardId,
          message: 'Failed to update card',
        });
      } finally {
        endTimer();
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
      wsEventsTotal.inc({ event: 'card-moved' });
      const endTimer = wsEventDuration.startTimer({ event: 'card-moved' });
      try {
        // Get card title, assignees, and list names for activity + notifications
        const cardResult = await executeWrite(
          'SELECT title, assignees FROM cards WHERE id = $1',
          [data.cardId]
        );
        const cardTitle = cardResult.rows[0]?.title || 'Card';
        const cardAssignees: number[] = cardResult.rows[0]?.assignees || [];

        const listsResult = await executeWrite(
          'SELECT id, title FROM lists WHERE id = ANY($1)',
          [[data.oldListId, data.newListId]]
        );
        const listMap = new Map(listsResult.rows.map((l: any) => [l.id, l.title]));
        const oldListTitle = listMap.get(data.oldListId) || 'List';
        const newListTitle = listMap.get(data.newListId) || 'List';

        // Update card position in DB
        await executeTransaction(async (client) => {
          await client.query(
            `UPDATE cards SET list_id = $1, position = $2, updated_at = NOW()
            WHERE id = $3`,
            [data.newListId, data.newPosition, data.cardId]
          );

          // Reorder positions in both lists
          // Shift positions down in old list
          await client.query(
            `UPDATE cards SET position = position - 1
            WHERE list_id = $1 AND position > $2 AND id != $3`,
            [data.oldListId, data.oldPosition, data.cardId]
          );

          // Shift positions up in new list
          await client.query(
            `UPDATE cards SET position = position + 1
            WHERE list_id = $1 AND position >= $2 AND id != $3`,
            [data.newListId, data.newPosition, data.cardId]
          );
        });
        
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

        // Notify assignees about the move
        if (cardAssignees.length > 0) {
          await notifyCardMoved(
            cardAssignees,
            socket.userId!,
            socket.userName!,
            data.boardId,
            data.cardId,
            cardTitle,
            oldListTitle,
            newListTitle
          );
        }

        // Broadcast move to all other users
        socket.to(`board:${data.boardId}`).emit('card-moved', {
          ...data,
          movedBy: { id: socket.userId, name: socket.userName },
        });

        cardMovesTotal.inc();

      } catch (error) {
        optimisticRollbacks.inc({ event: 'card-moved' });
        logger.error({ error, data }, 'Failed to move card');
        // Tell sender to rollback optimistic update
        socket.emit('card-move-failed', {
          cardId: data.cardId,
          oldListId: data.oldListId,
          oldPosition: data.oldPosition,
        });
      } finally {
        endTimer();
      }
    });

    socket.on('card-deleted', async (data: {
      cardId: number;
      listId: number;
      boardId: number;
    }) => {
      wsEventsTotal.inc({ event: 'card-deleted' });
      const endTimer = wsEventDuration.startTimer({ event: 'card-deleted' });
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
        optimisticRollbacks.inc({ event: 'card-deleted' });
        logger.error({ error, data }, 'Failed to delete card');
        socket.emit('card-error', {
          type: 'card-deleted',
          cardId: data.cardId,
          message: 'Failed to delete card',
        });
      } finally {
        endTimer();
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

    // Card reorder within list
    // --------------------------------
    socket.on('cards-reordered', async (data: {
      listId: number;
      cardIds: number[];
      boardId: number;
    }) => {
      try {
        // Update positions for each card in the new order
        for (let i = 0; i < data.cardIds.length; i++) {
          await executeWrite(
            'UPDATE cards SET position = $1, updated_at = NOW() WHERE id = $2 AND list_id = $3',
            [i, data.cardIds[i], data.listId]
          );
        }
        // Broadcast to others — sender already updated optimistically
        socket.to(`board:${data.boardId}`).emit('cards-reordered', {
          listId: data.listId,
          cardIds: data.cardIds,
        });
      } catch (error) {
        logger.error({ error, data }, 'Failed to reorder cards');
      }
    });
    
    // --------------------------------
    // List Move (reorder)
    // --------------------------------
    socket.on('list-moved', async (data: {
      listId: number;
      boardId: number;
      newPosition: number;
      oldPosition: number;
    }) => {
      try {
        const { listId, boardId, newPosition, oldPosition } = data;

        // Shift other lists to make room
        if (newPosition > oldPosition) {
          // Moving right — shift lists between old and new left by 1
          await executeWrite(
            `UPDATE lists SET position = position - 1
             WHERE board_id = $1 AND position > $2 AND position <= $3 AND id != $4`,
            [boardId, oldPosition, newPosition, listId]
          );
        } else {
          // Moving left — shift lists between new and old right by 1
          await executeWrite(
            `UPDATE lists SET position = position + 1
             WHERE board_id = $1 AND position >= $2 AND position < $3 AND id != $4`,
            [boardId, newPosition, oldPosition, listId]
          );
        }

        // Set the moved list to its new position
        await executeWrite(
          `UPDATE lists SET position = $1 WHERE id = $2`,
          [newPosition, listId]
        );

        // Broadcast to all other users on this board
        socket.to(`board:${boardId}`).emit('list-moved', {
          listId,
          newPosition,
        });

      } catch (error) {
        logger.error({ error, data }, 'Failed to move list');
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

      if (socket.userId) unregisterUserSocket(socket.userId, socket.id);

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