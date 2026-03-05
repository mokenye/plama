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

export const isSocketInitialized = (): boolean => !!socket;

export const getSocket = (): Socket => {
  if (!socket) throw new Error('Socket not initialized. Call initSocket() first.');
  return socket;
};

export const initSocket = (token: string): Socket => {
  // Reuse if socket exists at all — it reconnects automatically
  // DO NOT check socket.connected: if mid-connecting we'd create a second
  // socket and lose all existing listeners / server-side room membership
  if (socket) {
    return socket;
  }

  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') socket?.connect();
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
  const s = getSocket();
  if (s.connected) {
    s.emit('join-board', { boardId });
  } else {
    // Defer until connected — avoids lost emit during initial handshake
    s.once('connect', () => s.emit('join-board', { boardId }));
  }
};

export const leaveBoard = (boardId: number) => {
  getSocket().emit('leave-board', { boardId });
};

// ================================
// Away state
// ================================
export const emitUserAway = (boardId: number) => socket?.emit('user-away', { boardId });
export const emitUserActive = (boardId: number) => socket?.emit('user-active', { boardId });

// ================================
// Card / List Emission Helpers
// ================================
export const emitCardCreated = (data: {
  listId: number; title: string; description?: string; boardId: number; tempId: string;
}) => getSocket().emit('card-created', data);

export const emitCardUpdated = (data: {
  cardId: number; title?: string; description?: string;
  dueDate?: string | null; labels?: string[]; assignees?: number[]; boardId: number;
}) => getSocket().emit('card-updated', data);

export const emitCardMoved = (data: {
  cardId: number; newListId: number; newPosition: number;
  oldListId: number; oldPosition: number; boardId: number;
}) => getSocket().emit('card-moved', data);

export const emitCardDeleted = (data: { cardId: number; listId: number; boardId: number }) =>
  getSocket().emit('card-deleted', data);

export const emitListDeleted = (data: { listId: number; boardId: number }) =>
  getSocket().emit('list-deleted', data);

export const emitCardsReordered = (data: { listId: number; cardIds: number[]; boardId: number }) =>
  getSocket().emit('cards-reordered', data);

export const emitListMoved = (data: { listId: number; newPosition: number; oldPosition: number; boardId: number }) =>
  getSocket().emit('list-moved', data);

export const emitCursorMove = (data: { boardId: number; x: number; y: number }) =>
  getSocket().emit('cursor-move', data);

// ================================
// Board Events — bind / unbind
// Named handlers stored on socket so unbind only removes ours,
// not any other listeners (e.g. NotificationBell's 'notification' handler)
// ================================
export const bindBoardEvents = (boardId: number) => {
  const store = useBoardStore.getState;
  const s = getSocket();

  // Remove any stale board handlers first (handles React Strict Mode double-fire)
  unbindBoardEventsInternal(s);

  const onConnect = () => {
    store().setConnectionStatus('connected');
    s.emit('join-board', { boardId });
  };
  const onDisconnect    = () => store().setConnectionStatus('disconnected');
  const onReconnecting  = () => store().setConnectionStatus('reconnecting');

  const onCardCreated = ({ card, tempId }: SocketCard) => {
    const optimistic = tempId ? store().cards.find((c: any) => c.tempId === tempId) : undefined;
    if (optimistic && tempId) {
      store().confirmOptimisticCard(tempId, { ...card, createdByName: card.createdByName ?? optimistic.createdByName });
    } else {
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
    store().moveCard(cardId, newListId, newPosition);
  };

  const onCardDeleted   = ({ cardId }: SocketCardDeleted) => store().removeCard(cardId);
  const onListDeleted   = ({ listId }: { listId: number }) => store().removeList(listId);

  const onCardsReordered = ({ listId, cardIds }: { listId: number; cardIds: number[] }) =>
    store().reorderCards(listId, cardIds);

  const onListMoved = ({ listId, newPosition }: { listId: number; newPosition: number }) =>
    store().moveList(listId, newPosition);

  const onCardError = ({ tempId, cardId, type }: SocketError) => {
    if (type === 'card-created' && tempId) store().rollbackOptimisticCard(tempId);
    console.error(`[Socket] card-error for ${type} ${cardId || tempId}`);
  };

  const onCardMoveFailed = ({ cardId, oldListId, oldPosition }: SocketCardMoveFailed) =>
    store().rollbackCardMove(cardId, oldListId, oldPosition);

  const onActiveUsers  = ({ users }: SocketActiveUsers) => store().setActiveUsers(users);
  const onUserJoined   = ({ user }: SocketUserJoined)   => store().addActiveUser({ ...user, joinedAt: Date.now() });
  const onUserLeft     = ({ userId }: SocketUserLeft)   => store().removeActiveUser(userId);
  const onUserAway     = ({ userId }: { userId: number }) => store().setUserAway(userId, true);
  const onUserActive   = ({ userId }: { userId: number }) => store().setUserAway(userId, false);

  s.on('connect',          onConnect);
  s.on('disconnect',       onDisconnect);
  s.on('reconnecting',     onReconnecting);
  s.on('card-created',     onCardCreated);
  s.on('card-updated',     onCardUpdated);
  s.on('card-moved',       onCardMoved);
  s.on('card-deleted',     onCardDeleted);
  s.on('list-deleted',     onListDeleted);
  s.on('cards-reordered',  onCardsReordered);
  s.on('list-moved',       onListMoved);
  s.on('card-error',       onCardError);
  s.on('card-move-failed', onCardMoveFailed);
  s.on('active-users',     onActiveUsers);
  s.on('user-joined',      onUserJoined);
  s.on('user-left',        onUserLeft);
  s.on('user-away',        onUserAway);
  s.on('user-active',      onUserActive);

  // Store named handlers so unbind can remove only ours
  (s as any)._boardHandlers = {
    onConnect, onDisconnect, onReconnecting,
    onCardCreated, onCardUpdated, onCardMoved, onCardDeleted, onListDeleted,
    onCardsReordered, onListMoved,
    onCardError, onCardMoveFailed,
    onActiveUsers, onUserJoined, onUserLeft, onUserAway, onUserActive,
  };
};

function unbindBoardEventsInternal(s: Socket) {
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
}

export const unbindBoardEvents = () => {
  if (socket) unbindBoardEventsInternal(socket);
};

// ── Cursor tracking ────────────────────────────────────────────────────────
// Bound separately from board events so BoardView can manage its own lifecycle
export type CursorPayload = { userId: number; userName: string; x: number; y: number }

export const bindCursorHandler = (handler: (data: CursorPayload) => void) => {
  if (!socket) return
  socket.off('cursor-update', handler) // guard against double-bind
  socket.on('cursor-update', handler)
}

export const unbindCursorHandler = (handler: (data: CursorPayload) => void) => {
  if (!socket) return
  socket.off('cursor-update', handler)
}