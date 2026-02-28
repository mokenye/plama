// ================================
// Core Domain Types
// ================================

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface Board {
  id: number;
  title: string;
  description?: string;
  ownerId: number;
  ownerName: string;
  backgroundColor: string;
  memberCount?: number;
  userRole?: 'owner' | 'member';
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: number;
  boardId: number;
  title: string;
  position: number;
  createdAt: string;
}

export interface Card {
  id: number;
  listId: number;
  title: string;
  description?: string;
  position: number;
  createdBy?: number;
  createdByName?: string;
  dueDate?: string;
  labels?: string[];
  assignees?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: number;
  cardId: number;
  userId: number;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'owner' | 'member';
}

// ================================
// WebSocket Event Types
// ================================

export interface SocketCard {
  card: Card;
  createdBy?: { id: number; name: string };
  updatedBy?: { id: number; name: string };
  movedBy?: { id: number; name: string };
  deletedBy?: { id: number; name: string };
  tempId?: string; // For optimistic update reconciliation
}

export interface SocketCardMoved {
  cardId: number;
  newListId: number;
  newPosition: number;
  oldListId: number;
  oldPosition: number;
  movedBy?: { id: number; name: string };
}

export interface SocketCardDeleted {
  cardId: number;
  listId: number;
  deletedBy?: { id: number; name: string };
}

export interface SocketCardMoveFailed {
  cardId: number;
  oldListId: number;
  oldPosition: number;
}

export interface SocketActiveUsers {
  users: ActiveUser[];
}

export interface SocketUserJoined {
  user: { id: number; name: string };
}

export interface SocketUserLeft {
  userId: number;
}

export interface SocketCursorUpdate {
  userId: number;
  userName: string;
  x: number;
  y: number;
}

export interface SocketError {
  type: string;
  tempId?: string;
  cardId?: number;
  message: string;
}

// ================================
// Active/Presence Types
// ================================

export interface ActiveUser {
  id: number;
  name: string;
  joinedAt: number;
  cursor?: { x: number; y: number };
}

// ================================
// API Response Types
// ================================

export interface AuthResponse {
  user: User;
  token: string;
}

export interface BoardResponse {
  board: Board;
  lists: List[];
  cards: Card[];
  members: BoardMember[];
  userRole: 'owner' | 'member';
}

// ================================
// UI State Types
// ================================

export interface OptimisticCard extends Card {
  isOptimistic?: boolean; // True while server hasn't confirmed yet
  tempId?: string;
}

export type DragItem = {
  type: 'card';
  cardId: number;
  listId: number;
  position: number;
};