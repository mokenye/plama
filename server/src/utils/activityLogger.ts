import { executeWrite } from '../db/connection';

export type ActivityAction =
  | 'card_created'
  | 'card_moved'
  | 'card_updated'
  | 'card_deleted'
  | 'list_created'
  | 'list_deleted'
  | 'member_added';

export interface LogActivityParams {
  boardId: number;
  userId: number;
  userName: string;
  action: ActivityAction;
  entityType?: 'card' | 'list' | 'member';
  entityId?: number;
  entityName?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity to the board_activity table
 */
export async function logActivity({
  boardId,
  userId,
  userName,
  action,
  entityType,
  entityId,
  entityName,
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    await executeWrite(
      `INSERT INTO board_activity 
       (board_id, user_id, user_name, action, entity_type, entity_id, entity_name, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        boardId,
        userId,
        userName,
        action,
        entityType || null,
        entityId || null,
        entityName || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (error) {
    console.error('[Activity Log] Failed to log activity:', error);
    // Don't throw - activity logging should not break main functionality
  }
}

/**
 * Format activity for display
 */
export function formatActivity(activity: any): string {
  const { action, user_name, entity_name, metadata } = activity;

  switch (action) {
    case 'card_created':
      return `${user_name} created card "${entity_name}"`;
    
    case 'card_moved':
      return `${user_name} moved "${entity_name}" from ${metadata?.fromList} to ${metadata?.toList}`;
    
    case 'card_updated':
      return `${user_name} updated card "${entity_name}"`;
    
    case 'card_deleted':
      return `${user_name} deleted card "${entity_name}"`;
    
    case 'list_created':
      return `${user_name} created list "${entity_name}"`;
    
    case 'list_deleted':
      return `${user_name} deleted list "${entity_name}"`;
    
    case 'member_added':
      return `${user_name} added ${metadata?.memberName} to the board`;
    
    default:
      return `${user_name} performed an action`;
  }
}