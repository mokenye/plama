import { io, Socket } from 'socket.io-client';
import { useBoardStore } from '../store';
import type {
  SocketCard,
  SocketCardMoved,
  SocketCardDeleted,
  SocketCardMoveFailed,
  SocketActiveUsers,
  SocketUserJoined,
  SocketUserLeft,
  SocketError,
} from '../types';

// ================================
// Socket Instance (singleton)
// ================================
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocket() first.');
  }
  return socket;
};

export const initSocket = (token: string): Socket => {
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
};

// ================================
// Board Room Management
// ================================
export const joinBoard = (boardId: number) => {
  getSocket().emit('join-board', { boardId });
};

export const leaveBoard = (boardId: number) => {
  getSocket().emit('leave-board', { boardId });
};

// ================================
// Card Emission Helpers
// These are called by UI components
// ================================
export const emitCardCreated = (data: {
  listId: number;
  title: string;
  description?: string;
  boardId: number;
  tempId: string;
}) => {
  getSocket().emit('card-created', data);
};

export const emitCardUpdated = (data: {
  cardId: number;
  title?: string;
  description?: string;
  boardId: number;
}) => {
  getSocket().emit('card-updated', data);
};

export const emitCardMoved = (data: {
  cardId: number;
  newListId: number;
  newPosition: number;
  oldListId: number;
  oldPosition: number;
  boardId: number;
}) => {
  getSocket().emit('card-moved', data);
};

export const emitCardDeleted = (data: {
  cardId: number;
  listId: number;
  boardId: number;
}) => {
  getSocket().emit('card-deleted', data);
};

export const emitCursorMove = (data: { boardId: number; x: number; y: number }) => {
  getSocket().emit('cursor-move', data);
};

// ================================
// Event Listener Setup
// Called once when board loads
// Binds all incoming WebSocket events to Zustand store
// ================================
export const bindBoardEvents = (boardId: number) => {
  const store = useBoardStore.getState;
  const s = getSocket();

  // Connection state
  s.on('connect', () => {
    store().setConnectionStatus('connected');
    // Rejoin board room on reconnect
    joinBoard(boardId);
  });

  s.on('disconnect', () => {
    store().setConnectionStatus('disconnected');
  });

  s.on('reconnecting', () => {
    store().setConnectionStatus('reconnecting');
  });

  // ---- Card Events ----
  s.on('card-created', ({ card, tempId }: SocketCard) => {
    if (tempId) {
      // Confirm our own optimistic card
      store().confirmOptimisticCard(tempId, card);
    } else {
      // New card from another user
      store().addCard(card);
    }
  });

  s.on('card-updated', ({ card }: SocketCard) => {
    store().updateCard(card.id, card);
  });

  s.on('card-moved', ({ cardId, newListId, newPosition }: SocketCardMoved) => {
    store().moveCard(cardId, newListId, newPosition);
  });

  s.on('card-deleted', ({ cardId }: SocketCardDeleted) => {
    store().removeCard(cardId);
  });

  // Error handling / rollbacks
  s.on('card-error', ({ tempId, cardId, type }: SocketError) => {
    if (type === 'card-created' && tempId) {
      store().rollbackOptimisticCard(tempId);
    }
    console.error(`Socket error for ${type} ${cardId || tempId}`);
  });

  s.on('card-move-failed', ({ cardId, oldListId, oldPosition }: SocketCardMoveFailed) => {
    store().rollbackCardMove(cardId, oldListId, oldPosition);
  });

  // ---- Presence Events ----
  s.on('active-users', ({ users }: SocketActiveUsers) => {
    store().setActiveUsers(users);
  });

  s.on('user-joined', ({ user }: SocketUserJoined) => {
    store().addActiveUser({ ...user, joinedAt: Date.now() });
  });

  s.on('user-left', ({ userId }: SocketUserLeft) => {
    store().removeActiveUser(userId);
  });
};

export const unbindBoardEvents = () => {
  const s = socket;
  if (!s) return;

  s.off('connect');
  s.off('disconnect');
  s.off('reconnecting');
  s.off('card-created');
  s.off('card-updated');
  s.off('card-moved');
  s.off('card-deleted');
  s.off('card-error');
  s.off('card-move-failed');
  s.off('active-users');
  s.off('user-joined');
  s.off('user-left');
  s.off('cursor-update');
};