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

export const isSocketInitialized = (): boolean => {
  return socket !== null && socket.connected;
};

export const getSocket = (): Socket => {
  if (!socket) {
    throw new Error('Socket not initialized. Call initSocket() first.');
  }
  return socket;
};

export const initSocket = (token: string): Socket => {
  if (socket?.connected) {
    console.log('[Socket] Already connected, reusing existing socket');
    return socket;
  }

  console.log('[Socket] Initializing new socket connection...');
  
  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected successfully, ID:', socket?.id);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected, reason:', reason);
    if (reason === 'io server disconnect') {
      socket?.connect();
    }
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
  console.log('[Socket] Joining board:', boardId);
  getSocket().emit('join-board', { boardId });
};

export const leaveBoard = (boardId: number) => {
  getSocket().emit('leave-board', { boardId });
};

// ================================
// Away state
// ================================
export const emitUserAway = (boardId: number) => {
  socket?.emit('user-away', { boardId });
};

export const emitUserActive = (boardId: number) => {
  socket?.emit('user-active', { boardId });
};

// ================================
// Card Emission Helpers
// ================================
export const emitCardCreated = (data: {
  listId: number;
  title: string;
  description?: string;
  boardId: number;
  tempId: string;
}) => {
  console.log('[Socket] Emitting card-created:', data);
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
  console.log('[Socket] Emitting card-moved:', data);
  getSocket().emit('card-moved', data);
};

export const emitCardDeleted = (data: {
  cardId: number;
  listId: number;
  boardId: number;
}) => {
  getSocket().emit('card-deleted', data);
};

export const emitListDeleted = (data: {
  listId: number;
  boardId: number;
}) => {
  getSocket().emit('list-deleted', data);
};

export const emitCursorMove = (data: { boardId: number; x: number; y: number }) => {
  getSocket().emit('cursor-move', data);
};

// ================================
// Event Listener Setup
// ================================
export const bindBoardEvents = (boardId: number) => {
  console.log('[Socket] Binding events for board:', boardId);
  const store = useBoardStore.getState;
  const s = getSocket();

  // Connection state
  s.on('connect', () => {
    console.log('[Socket] Reconnected, rejoining board');
    store().setConnectionStatus('connected');
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
    console.log('[Socket] Received card-created:', { card, tempId });
    if (tempId) {
      // Preserve createdByName from the optimistic card — the server response
      // may not include it if the JOIN wasn't done in the RETURNING clause
      const optimistic = store().cards.find(
        (c: any) => c.tempId === tempId
      );
      const confirmedCard = {
        ...card,
        createdByName: card.createdByName ?? optimistic?.createdByName,
      };
      store().confirmOptimisticCard(tempId, confirmedCard);
    } else {
      // New card from another user — createdByName comes from server
      store().addCard(card);
    }
  });

  s.on('card-updated', ({ card }: SocketCard) => {
    store().updateCard(card.id, card);
  });

  s.on('card-moved', ({ cardId, newListId, newPosition }: SocketCardMoved) => {
    console.log('[Socket] Received card-moved:', { cardId, newListId, newPosition });
    store().moveCard(cardId, newListId, newPosition);
  });

  s.on('card-deleted', ({ cardId }: SocketCardDeleted) => {
    store().removeCard(cardId);
  });

  s.on('list-deleted', ({ listId }: { listId: number }) => {
    console.log('[Socket] Received list-deleted:', listId);
    store().removeList(listId);
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
    console.log('[Socket] Received active-users:', users);
    store().setActiveUsers(users);
  });

  s.on('user-joined', ({ user }: SocketUserJoined) => {
    console.log('[Socket] User joined:', user);
    store().addActiveUser({ ...user, joinedAt: Date.now() });
  });

  s.on('user-left', ({ userId }: SocketUserLeft) => {
    console.log('[Socket] User left:', userId);
    store().removeActiveUser(userId);
  });

  // Away state — another user went away or came back
  s.on('user-away', ({ userId }: { userId: number }) => {
    store().setUserAway(userId, true);
  });

  s.on('user-active', ({ userId }: { userId: number }) => {
    store().setUserAway(userId, false);
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
  s.off('user-away');
  s.off('user-active');
  s.off('cursor-update');
};