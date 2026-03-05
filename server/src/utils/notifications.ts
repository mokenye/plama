import { executeWrite, executeRead } from '../db/connection';
import type { Server } from 'socket.io';

// io is set once at startup by server.ts calling setIo(io)
// This breaks the circular dependency:
//   server.ts → handlers.ts → notifications_util.ts → server.ts (circular)
let _io: Server | null = null;
export function setIo(io: Server) { _io = io; }
export function getIo() { return _io; }

// userId → set of socketIds currently connected
export const userSockets = new Map<number, Set<string>>();

export type NotificationType =
  | 'assigned'
  | 'mentioned'
  | 'card_updated'
  | 'card_moved'
  | 'comment_added'
  | 'due_soon'
  | 'board_invite';

interface CreateNotificationParams {
  userId: number;
  boardId?: number;
  cardId?: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}


export function registerUserSocket(userId: number, socketId: string) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socketId);
}

export function unregisterUserSocket(userId: number, socketId: string) {
  userSockets.get(userId)?.delete(socketId);
}

// ── Core create + push ───────────────────────────────────────────────────────
export async function createNotification({
  userId,
  boardId,
  cardId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams): Promise<void> {
  try {
    const result = await executeWrite(
      `INSERT INTO notifications (user_id, board_id, card_id, type, title, message, link, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'UTC')
       RETURNING *`,
      [userId, boardId ?? null, cardId ?? null, type, title, message, link ?? null]
    );

    const row = result.rows[0];
    const notification = {
      id: row.id,
      userId: row.user_id,
      boardId: row.board_id,
      cardId: row.card_id,
      type: row.type,
      title: row.title,
      message: row.message,
      read: row.read,
      link: row.link,
      // Always send as UTC ISO string so clients parse it correctly
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at + 'Z').toISOString(),
    };

    // Push to recipient's personal room immediately — no polling needed
    if (_io) {
      _io.to(`user:${userId}`).emit('notification', notification);
    }
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
  }
}

// ── Fetch board name helper ──────────────────────────────────────────────────
async function getBoardName(boardId: number): Promise<string> {
  try {
    const result = await executeRead(
      'SELECT title FROM boards WHERE id = $1',
      [boardId]
    );
    return result.rows[0]?.title ?? 'a board';
  } catch {
    return 'a board';
  }
}

// ── Notification helpers ─────────────────────────────────────────────────────

export async function notifyBoardInvite(
  inviteeId: number,
  inviterId: number,
  inviterName: string,
  boardId: number
): Promise<void> {
  if (inviteeId === inviterId) return;
  const boardName = await getBoardName(boardId);

  // Push full board object to invitee's dashboard socket so it appears instantly
  try {
    const boardResult = await executeRead(
      `SELECT
         b.id,
         b.title,
         b.description,
         b.background_color   AS "backgroundColor",
         b.owner_id           AS "ownerId",
         b.created_at         AS "createdAt",
         u.name               AS "ownerName",
         (SELECT COUNT(*)::int FROM board_members bm WHERE bm.board_id = b.id) AS "memberCount"
       FROM boards b
       JOIN users u ON b.owner_id = u.id
       WHERE b.id = $1`,
      [boardId]
    );

    if (boardResult.rows[0] && _io) {
      const board = boardResult.rows[0];
      _io.to(`user:${inviteeId}`).emit('board-invited', { board });
    }
  } catch (err) {
    console.error('[Notifications] Failed to push board-invited:', err);
  }

  await createNotification({
    userId: inviteeId,
    boardId,
    type: 'board_invite',
    title: 'You were invited to a board',
    message: `${inviterName} invited you to "${boardName}"`,
    link: `/board/${boardId}`,
  });
}

export async function notifyCardAssignment(
  assigneeId: number,
  assignerId: number,
  assignerName: string,
  boardId: number,
  cardId: number,
  cardTitle: string
): Promise<void> {
  if (assigneeId === assignerId) return;
  const boardName = await getBoardName(boardId);
  await createNotification({
    userId: assigneeId,
    boardId,
    cardId,
    type: 'assigned',
    title: 'You were assigned to a card',
    message: `${assignerName} assigned you to "${cardTitle}" on "${boardName}"`,
    link: `/board/${boardId}`,
  });
}

export async function notifyCardComment(
  assigneeIds: number[],
  commenterId: number,
  commenterName: string,
  boardId: number,
  cardId: number,
  cardTitle: string
): Promise<void> {
  const boardName = await getBoardName(boardId);
  for (const assigneeId of assigneeIds) {
    if (assigneeId === commenterId) continue;
    await createNotification({
      userId: assigneeId,
      boardId,
      cardId,
      type: 'comment_added',
      title: 'New comment on your card',
      message: `${commenterName} commented on "${cardTitle}" in "${boardName}"`,
      link: `/board/${boardId}`,
    });
  }
}

export async function notifyCardMoved(
  assigneeIds: number[],
  moverId: number,
  moverName: string,
  boardId: number,
  cardId: number,
  cardTitle: string,
  fromList: string,
  toList: string
): Promise<void> {
  const boardName = await getBoardName(boardId);
  for (const assigneeId of assigneeIds) {
    if (assigneeId === moverId) continue;
    await createNotification({
      userId: assigneeId,
      boardId,
      cardId,
      type: 'card_moved',
      title: 'Card moved',
      message: `${moverName} moved "${cardTitle}" from "${fromList}" to "${toList}" in "${boardName}"`,
      link: `/board/${boardId}`,
    });
  }
}