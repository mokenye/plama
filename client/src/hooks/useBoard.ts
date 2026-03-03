import { useEffect, useCallback } from 'react';
import { boardsApi, listsApi } from '../services/api';
import {
  initSocket,
  joinBoard,
  leaveBoard,
  bindBoardEvents,
  unbindBoardEvents,
  emitCardCreated,
  emitCardUpdated,
  emitCardMoved,
  emitCardDeleted,
  emitListDeleted,
  emitUserAway,
  emitUserActive,
  isSocketInitialized,
} from '../services/socket';
import { useBoardStore, useAuthStore } from '../store';
import type { OptimisticCard } from '../types';

// ================================
// useBoard - main hook for board page
// Handles: data fetching, WebSocket setup, actions
// ================================
export const useBoard = (boardId: number) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const {
    board,
    lists,
    cards,
    members,
    activeUsers,
    userRole,
    isLoading,
    error,
    connectionStatus,
    setBoardData,
    addOptimisticCard,
    rollbackOptimisticCard,
    addList,
    removeList,
    setLoading,
    setError,
    reset,
  } = useBoardStore();

  // --------------------------------
  // Load board data & setup WebSocket
  // --------------------------------
  useEffect(() => {
    if (!boardId || !token) return;

    let mounted = true;

    const setup = async () => {
      setLoading(true);

      try {
        console.log('[useBoard] Loading board:', boardId);
        const data = await boardsApi.getById(boardId);
        console.log('[useBoard] Board data loaded:', data);
        if (!mounted) return;
        setBoardData(data);

        console.log('[useBoard] Initializing socket...');
        initSocket(token);
        bindBoardEvents(boardId);
        joinBoard(boardId);

      } catch (err: unknown) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load board';
        console.error('[useBoard] Board load error:', err);
        setError(message);
        setLoading(false);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (isSocketInitialized()) {
        leaveBoard(boardId);
        unbindBoardEvents();
      }
      reset();
    };
  }, [boardId, token]);

  // --------------------------------
  // Away state — tab visibility tracking
  // --------------------------------
  useEffect(() => {
    if (!boardId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        emitUserAway(boardId);
      } else {
        emitUserActive(boardId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [boardId]);

  // --------------------------------
  // Card Actions with Optimistic Updates
  // --------------------------------
  const createCard = useCallback(
    (listId: number, title: string, description?: string) => {
      if (!user || !board) return;

      const tempId = `temp-${Date.now()}-${Math.random()}`;

      const optimisticCard: OptimisticCard = {
        id: -1,
        listId,
        title,
        description,
        position: 9999,
        createdBy: user.id,
        createdByName: user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOptimistic: true,
        tempId,
      };
      addOptimisticCard(optimisticCard);

      emitCardCreated({ listId, title, description, boardId: board.id, tempId });

      const rollbackTimer = setTimeout(() => {
        rollbackOptimisticCard(tempId);
      }, 5000);

      return () => clearTimeout(rollbackTimer);
    },
    [user, board, addOptimisticCard, rollbackOptimisticCard]
  );

  const updateCard = useCallback(
    (cardId: number, updates: { title?: string; description?: string }) => {
      if (!board) return;
      useBoardStore.getState().updateCard(cardId, updates);
      emitCardUpdated({ cardId, ...updates, boardId: board.id });
    },
    [board]
  );

  const moveCard = useCallback(
    (
      cardId: number,
      newListId: number,
      newPosition: number,
      oldListId: number,
      oldPosition: number
    ) => {
      if (!board) return;
      useBoardStore.getState().moveCard(cardId, newListId, newPosition);
      emitCardMoved({ cardId, newListId, newPosition, oldListId, oldPosition, boardId: board.id });
    },
    [board]
  );

  const deleteCard = useCallback(
    (cardId: number, listId: number) => {
      if (!board) return;
      useBoardStore.getState().removeCard(cardId);
      emitCardDeleted({ cardId, listId, boardId: board.id });
    },
    [board]
  );

  // --------------------------------
  // List Actions (REST, not WebSocket)
  // --------------------------------
  const createList = useCallback(
    async (title: string) => {
      if (!board) return;
      try {
        console.log('[useBoard] Creating list:', title, 'for board:', board.id);
        const { list } = await listsApi.create(board.id, { title });
        console.log('[useBoard] List created:', list);
        useBoardStore.getState().addList(list);
      } catch (err: any) {
        console.error('[useBoard] Create list error:', err);
        const errorMsg = err.response?.data?.error || err.message || 'Failed to create list';
        alert(errorMsg);
      }
    },
    [board]
  );

  const deleteList = useCallback(
    (listId: number) => {
      if (!board) return;

      const cardsInList = cards.filter(c => c.listId === listId);
      const cardCount = cardsInList.length;

      const confirmed = confirm(
        `Delete this list and all ${cardCount} card${cardCount !== 1 ? 's' : ''} inside? This cannot be undone.`
      );

      if (!confirmed) return;

      emitListDeleted({ listId, boardId: board.id });
      useBoardStore.getState().removeList(listId);
    },
    [board, cards]
  );

  const getCardsForList = useCallback(
    (listId: number) =>
      cards
        .filter((c) => c.listId === listId)
        .sort((a, b) => a.position - b.position),
    [cards]
  );

  return {
    board,
    lists,
    cards,
    members,
    activeUsers,
    userRole,
    isLoading,
    error,
    connectionStatus,
    getCardsForList,
    createCard,
    updateCard,
    moveCard,
    deleteCard,
    createList,
    deleteList,
  };
};