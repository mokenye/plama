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
  // If we already have a socket (connected or connecting), reuse it
  if (socket) {
    console.log('[Socket] Reusing existing socket, connected:', socket.connected);
    return socket;
  }

  console.log('[Socket] Initializing new socket connection...');

  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
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
  const s = socket;
  if (!s) return;

  if (s.connected) {
    console.log('[Socket] Joining board:', boardId);
    s.emit('join-board', { boardId });
  } else {
    // Socket is connecting — join as soon as it connects
    console.log('[Socket] Queuing join-board until connected:', boardId);
    s.once('connect', () => {
      console.log('[Socket] Deferred join-board:', boardId);
      s.emit('join-board', { boardId });
    });
  }
};

export const leaveBoard = (boardId: number) => {
  socket?.emit('leave-board', { boardId });
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
  dueDate?: string | null;
  labels?: string[];
  assignees?: number[];
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

export const emitCardsReordered = (data: {
  listId: number;
  cardIds: number[];
  boardId: number;
}) => {
  getSocket().emit('cards-reordered', data);
};

export const emitListMoved = (data: {
  listId: number;
  newPosition: number;
  oldPosition: number;
  boardId: number;
}) => {
  getSocket().emit('list-moved', data);
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
  console.log('[Socket] bindBoardEvents called for board:', boardId, '| socket id:', socket?.id, '| connected:', socket?.connected);

  // Always unbind first to prevent duplicate listeners from re-mounts
  unbindBoardEventsInternal();

  const store = useBoardStore.getState;
  const s = getSocket();

  // ---- Connection state ----
  const onConnect = () => {
    console.log('[Socket] Reconnected, rejoining board', boardId);
    store().setConnectionStatus('connected');
    s.emit('join-board', { boardId });
  };
  const onDisconnect = () => store().setConnectionStatus('disconnected');
  const onReconnecting = () => store().setConnectionStatus('reconnecting');

  s.on('connect', onConnect);
  s.on('disconnect', onDisconnect);
  s.on('reconnecting', onReconnecting);

  // ---- Card Events ----
  const onCardCreated = ({ card, tempId }: SocketCard) => {
    const optimistic = tempId
      ? store().cards.find((c: any) => c.tempId === tempId)
      : undefined;

    console.log('[Socket] card-created received', {
      cardId: card?.id,
      tempId,
      isOwnOptimistic: !!optimistic,
      currentCards: store().cards.length,
    });

    if (optimistic && tempId) {
      // This is our own card being confirmed by the server
      store().confirmOptimisticCard(tempId, {
        ...card,
        createdByName: card.createdByName ?? optimistic.createdByName,
      });
    } else {
      // New card from another user (or server broadcast with tempId we don't own)
      store().addCard(card);
    }
  };

  const onCardUpdated = (payload: any) => {
    if (payload.card) {
      store().updateCard(payload.card.id, payload.card);
    } else if (payload.cardId) {
      const { cardId, boardId: _b, ...updates } = payload;
      store().updateCard(cardId, updates);
    }
  };

  const onCardMoved = ({ cardId, newListId, newPosition }: SocketCardMoved) => {
    console.log('[Socket] Received card-moved:', { cardId, newListId, newPosition });
    store().moveCard(cardId, newListId, newPosition);
  };

  const onCardDeleted = ({ cardId }: SocketCardDeleted) => {
    store().removeCard(cardId);
  };

  const onListDeleted = ({ listId }: { listId: number }) => {
    console.log('[Socket] Received list-deleted:', listId);
    store().removeList(listId);
  };

  const onCardError = ({ tempId, cardId, type }: SocketError) => {
    if (type === 'card-created' && tempId) store().rollbackOptimisticCard(tempId);
    console.error(`Socket error for ${type} ${cardId || tempId}`);
  };

  const onCardMoveFailed = ({ cardId, oldListId, oldPosition }: SocketCardMoveFailed) => {
    store().rollbackCardMove(cardId, oldListId, oldPosition);
  };

  // ---- Presence Events ----
  const onActiveUsers = ({ users }: SocketActiveUsers) => {
    console.log('[Socket] Received active-users:', users);
    store().setActiveUsers(users);
  };

  const onUserJoined = ({ user }: SocketUserJoined) => {
    console.log('[Socket] User joined:', user);
    store().addActiveUser({ ...user, joinedAt: Date.now() });
  };

  const onUserLeft = ({ userId }: SocketUserLeft) => {
    console.log('[Socket] User left:', userId);
    store().removeActiveUser(userId);
  };

  const onCardsReordered = ({ listId, cardIds }: { listId: number; cardIds: number[] }) => {
    store().reorderCards(listId, cardIds);
  };

  const onListMoved = ({ listId, newPosition }: { listId: number; newPosition: number }) => {
    store().moveList(listId, newPosition);
  };

  const onUserAway = ({ userId }: { userId: number }) => store().setUserAway(userId, true);
  const onUserActive = ({ userId }: { userId: number }) => store().setUserAway(userId, false);

  s.on('card-created',     onCardCreated);
  s.on('card-updated',     onCardUpdated);
  s.on('card-moved',       onCardMoved);
  s.on('card-deleted',     onCardDeleted);
  s.on('list-deleted',     onListDeleted);
  s.on('cards-reordered',  onCardsReordered);
  s.on('list-moved',       onListMoved);
  s.on('card-error',       onCardError);
  s.on('card-move-failed',onCardMoveFailed);
  s.on('active-users',    onActiveUsers);
  s.on('user-joined',     onUserJoined);
  s.on('user-left',       onUserLeft);
  s.on('user-away',       onUserAway);
  s.on('user-active',     onUserActive);

  // Store all named refs for clean removal
  (s as any)._boardHandlers = {
    onConnect, onDisconnect, onReconnecting,
    onCardCreated, onCardUpdated, onCardMoved, onCardDeleted, onListDeleted,
    onCardsReordered, onListMoved,
    onCardError, onCardMoveFailed,
    onActiveUsers, onUserJoined, onUserLeft, onUserAway, onUserActive,
  };
};

// Internal — removes only named board handlers, not initSocket's listeners
const unbindBoardEventsInternal = () => {
  const s = socket;
  if (!s) return;

  const h = (s as any)._boardHandlers;
  if (!h) return;

  s.off('connect',          h.onConnect);
  s.off('disconnect',       h.onDisconnect);
  s.off('reconnecting',     h.onReconnecting);
  s.off('card-created',     h.onCardCreated);
  s.off('card-updated',     h.onCardUpdated);
  s.off('card-moved',       h.onCardMoved);
  s.off('card-deleted',     h.onCardDeleted);
  s.off('list-deleted',     h.onListDeleted);
  s.off('cards-reordered',  h.onCardsReordered);
  s.off('list-moved',       h.onListMoved);
  s.off('card-error',       h.onCardError);
  s.off('card-move-failed', h.onCardMoveFailed);
  s.off('active-users',     h.onActiveUsers);
  s.off('user-joined',      h.onUserJoined);
  s.off('user-left',        h.onUserLeft);
  s.off('user-away',        h.onUserAway);
  s.off('user-active',      h.onUserActive);

  delete (s as any)._boardHandlers;
};

// Public — called from useBoard cleanup
export const unbindBoardEvents = unbindBoardEventsInternal;