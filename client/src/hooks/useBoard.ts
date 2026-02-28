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
        // 1. Fetch initial board data via REST
        const data = await boardsApi.getById(boardId);
        console.log('[useBoard] Board data loaded:', data);
        if (!mounted) return;
        setBoardData(data);

        // 2. Init socket if not already connected
        console.log('[useBoard] Initializing socket...');
        initSocket(token);

        // 3. Bind all WebSocket event handlers
        bindBoardEvents(boardId);

        // 4. Join the board room
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

    // Cleanup on unmount or boardId change
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
  // Card Actions with Optimistic Updates
  // --------------------------------
  const createCard = useCallback(
    (listId: number, title: string, description?: string) => {
      if (!user || !board) return;

      // Generate temp ID for optimistic update reconciliation
      const tempId = `temp-${Date.now()}-${Math.random()}`;

      // 1. Optimistically add to UI immediately
      const optimisticCard: OptimisticCard = {
        id: -1, // Placeholder until server confirms
        listId,
        title,
        description,
        position: 9999, // Will be corrected on server confirm
        createdBy: user.id,
        createdByName: user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOptimistic: true,
        tempId,
      };
      addOptimisticCard(optimisticCard);

      // 2. Emit to server via WebSocket
      emitCardCreated({ listId, title, description, boardId: board.id, tempId });

      // 3. Rollback if no server confirmation within 5s
      const rollbackTimer = setTimeout(() => {
        rollbackOptimisticCard(tempId);
      }, 5000);

      // Clear rollback timer when server confirms (handled in socket service)
      return () => clearTimeout(rollbackTimer);
    },
    [user, board, addOptimisticCard, rollbackOptimisticCard]
  );

  const updateCard = useCallback(
    (cardId: number, updates: { title?: string; description?: string }) => {
      if (!board) return;
      
      // 1. Optimistically update UI
      useBoardStore.getState().updateCard(cardId, updates);
      
      // 2. Emit to server
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
      
      // 1. Optimistically update UI immediately
      useBoardStore.getState().moveCard(cardId, newListId, newPosition);
      
      // 2. Emit to server
      emitCardMoved({
        cardId,
        newListId,
        newPosition,
        oldListId,
        oldPosition,
        boardId: board.id,
      });
    },
    [board]
  );

  const deleteCard = useCallback(
    (cardId: number, listId: number) => {
      if (!board) return;
      
      // 1. Optimistically remove from UI
      useBoardStore.getState().removeCard(cardId);
      
      // 2. Emit to server
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

  // Get cards for a specific list (sorted by position)
  const getCardsForList = useCallback(
    (listId: number) =>
      cards
        .filter((c) => c.listId === listId)
        .sort((a, b) => a.position - b.position),
    [cards]
  );

  return {
    // Data
    board,
    lists,
    cards,
    members,
    activeUsers,
    userRole,
    isLoading,
    error,
    connectionStatus,

    // Helpers
    getCardsForList,

    // Actions
    createCard,
    updateCard,
    moveCard,
    deleteCard,
    createList,
  };
};