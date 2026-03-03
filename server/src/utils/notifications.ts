import { executeWrite } from '../db/connection';

export type NotificationType = 
  | 'assigned'
  | 'mentioned'
  | 'card_updated'
  | 'card_moved'
  | 'comment_added'
  | 'due_soon';

interface CreateNotificationParams {
  userId: number;
  boardId?: number;
  cardId?: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

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
    await executeWrite(
      `INSERT INTO notifications (user_id, board_id, card_id, type, title, message, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, boardId || null, cardId || null, type, title, message, link || null]
    );
  } catch (error) {
    console.error('[Notifications] Failed to create notification:', error);
  }
}

// Helper: Notify when assigned to a card
export async function notifyCardAssignment(
  assigneeId: number,
  assignerId: number,
  assignerName: string,
  boardId: number,
  cardId: number,
  cardTitle: string
): Promise<void> {
  // Don't notify if user assigned themselves
  if (assigneeId === assignerId) return;

  await createNotification({
    userId: assigneeId,
    boardId,
    cardId,
    type: 'assigned',
    title: 'You were assigned to a card',
    message: `${assignerName} assigned you to "${cardTitle}"`,
    link: `/board/${boardId}`,
  });
}

// Helper: Notify when someone comments on your card
export async function notifyCardComment(
  assigneeIds: number[],
  commenterId: number,
  commenterName: string,
  boardId: number,
  cardId: number,
  cardTitle: string
): Promise<void> {
  for (const assigneeId of assigneeIds) {
    // Don't notify the commenter
    if (assigneeId === commenterId) continue;

    await createNotification({
      userId: assigneeId,
      boardId,
      cardId,
      type: 'comment_added',
      title: 'New comment on your card',
      message: `${commenterName} commented on "${cardTitle}"`,
      link: `/board/${boardId}`,
    });
  }
}

// Helper: Notify when a card you're assigned to is moved
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
  for (const assigneeId of assigneeIds) {
    // Don't notify the person who moved it
    if (assigneeId === moverId) continue;

    await createNotification({
      userId: assigneeId,
      boardId,
      cardId,
      type: 'card_moved',
      title: 'Card moved',
      message: `${moverName} moved "${cardTitle}" from ${fromList} to ${toList}`,
      link: `/board/${boardId}`,
    });
  }
}