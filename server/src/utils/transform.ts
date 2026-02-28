// Transform database snake_case to frontend camelCase

export const transformCard = (dbCard: any) => ({
  id: dbCard.id,
  listId: dbCard.list_id,
  title: dbCard.title,
  description: dbCard.description,
  position: dbCard.position,
  createdBy: dbCard.created_by,
  createdByName: dbCard.created_by_name,
  dueDate: dbCard.due_date,
  labels: dbCard.labels || [],
  assignees: dbCard.assignees || [],
  createdAt: dbCard.created_at,
  updatedAt: dbCard.updated_at,
});

export const transformList = (dbList: any) => ({
  id: dbList.id,
  boardId: dbList.board_id,
  title: dbList.title,
  position: dbList.position,
  createdAt: dbList.created_at,
});

export const transformBoard = (dbBoard: any) => ({
  id: dbBoard.id,
  title: dbBoard.title,
  description: dbBoard.description,
  ownerId: dbBoard.owner_id,
  ownerName: dbBoard.owner_name,
  backgroundColor: dbBoard.background_color,
  memberCount: dbBoard.member_count,
  userRole: dbBoard.user_role,
  createdAt: dbBoard.created_at,
  updatedAt: dbBoard.updated_at,
});

export const transformMember = (dbMember: any) => ({
  id: dbMember.id,
  name: dbMember.name,
  email: dbMember.email,
  avatarUrl: dbMember.avatar_url,
  role: dbMember.role,
});