import { create } from 'zustand';
import type {
  User,
  Board,
  List,
  Card,
  BoardMember,
  ActiveUser,
  OptimisticCard,
} from '../types';

// ================================
// Auth Store
// ================================
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

// ================================
// Board List Store (dashboard)
// ================================
interface BoardsState {
  boards: Board[];
  isLoading: boolean;
  error: string | null;
  setBoards: (boards: Board[]) => void;
  addBoard: (board: Board) => void;
  removeBoard: (boardId: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useBoardsStore = create<BoardsState>((set) => ({
  boards: [],
  isLoading: false,
  error: null,
  setBoards: (boards) => set({ boards }),
  addBoard: (board) => set((state) => ({ boards: [board, ...state.boards] })),
  removeBoard: (boardId) =>
    set((state) => ({ boards: state.boards.filter((b) => b.id !== boardId) })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

// ================================
// Active Board Store (board view)
// This is where real-time magic happens
// ================================
interface BoardState {
  board: Board | null;
  lists: List[];
  cards: OptimisticCard[];
  members: BoardMember[];
  activeUsers: ActiveUser[];
  userRole: 'owner' | 'member' | null;
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';

  // Initial load
  setBoardData: (data: {
    board: Board;
    lists: List[];
    cards: Card[];
    members: BoardMember[];
    userRole: 'owner' | 'member';
  }) => void;

  // List mutations
  addList: (list: List) => void;
  updateList: (listId: number, updates: Partial<List>) => void;
  removeList: (listId: number) => void;

  // Card mutations (called from WebSocket events)
  addCard: (card: Card, tempId?: string) => void;
  updateCard: (cardId: number, updates: Partial<Card>) => void;
  moveCard: (cardId: number, newListId: number, newPosition: number) => void;
  removeCard: (cardId: number) => void;

  // Reordering
  reorderCards: (listId: number, cardIds: number[]) => void;
  moveList: (listId: number, newPosition: number) => void;

  // Optimistic updates
  addOptimisticCard: (card: OptimisticCard) => void;
  confirmOptimisticCard: (tempId: string, realCard: Card) => void;
  rollbackOptimisticCard: (tempId: string) => void;
  rollbackCardMove: (cardId: number, oldListId: number, oldPosition: number) => void;

  // Presence
  setActiveUsers: (users: ActiveUser[]) => void;
  addActiveUser: (user: ActiveUser) => void;
  removeActiveUser: (userId: number) => void;
  setUserAway: (userId: number, away: boolean) => void;

  // Member mutations
  addMember: (member: BoardMember) => void;
  removeMember: (userId: number) => void;

  // UI state
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  board: null,
  lists: [],
  cards: [],
  members: [],
  activeUsers: [],
  userRole: null,
  isLoading: false,
  error: null,
  connectionStatus: 'disconnected',

  setBoardData: ({ board, lists, cards, members, userRole }) =>
    set({ board, lists, cards, members, userRole, isLoading: false, error: null }),

  // Lists
  addList: (list) => set((state) => ({ lists: [...state.lists, list] })),
  updateList: (listId, updates) =>
    set((state) => ({
      lists: state.lists.map((l) => (l.id === listId ? { ...l, ...updates } : l)),
    })),
  removeList: (listId) =>
    set((state) => ({
      lists: state.lists.filter((l) => l.id !== listId),
      cards: state.cards.filter((c) => c.listId !== listId),
    })),

  // Cards
  addCard: (card, tempId) =>
    set((state) => {
      // If tempId provided, this is confirming an optimistic card
      if (tempId) {
        return {
          cards: state.cards.map((c) =>
            c.tempId === tempId ? { ...card, isOptimistic: false } : c
          ),
        };
      }
      // New card from another user
      return { cards: [...state.cards, card] };
    }),

  updateCard: (cardId, updates) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c)),
    })),

  moveCard: (cardId, newListId, newPosition) =>
    set((state) => {
      // Remove card from its current list, insert at newPosition in target list,
      // then rewrite positions for both affected lists so there are no duplicates.
      const moving = state.cards.find(c => c.id === cardId)
      if (!moving) return {}

      const oldListId = moving.listId

      // Cards staying in the old list, re-indexed from 0
      const oldListCards = state.cards
        .filter(c => c.listId === oldListId && c.id !== cardId)
        .sort((a, b) => a.position - b.position)
        .map((c, i) => ({ ...c, position: i }))

      // Cards already in the target list (card may be moving within same list)
      const targetListCards = state.cards
        .filter(c => c.listId === newListId && c.id !== cardId)
        .sort((a, b) => a.position - b.position)

      // Splice the moved card in at newPosition
      targetListCards.splice(newPosition, 0, { ...moving, listId: newListId })
      const newTargetCards = targetListCards.map((c, i) => ({ ...c, position: i }))

      // Merge: unchanged cards + reindexed old list + reindexed target list
      const untouched = state.cards.filter(
        c => c.listId !== oldListId && c.listId !== newListId
      )

      return {
        cards: [...untouched, ...oldListCards, ...newTargetCards],
      }
    }),

  removeCard: (cardId) =>
    set((state) => ({ cards: state.cards.filter((c) => c.id !== cardId) })),

  reorderCards: (listId, cardIds) =>
    set((state) => ({
      cards: state.cards.map((c) => {
        if (c.listId !== listId) return c;
        const idx = cardIds.indexOf(c.id);
        return idx === -1 ? c : { ...c, position: idx };
      }),
    })),

  moveList: (listId, newPosition) =>
    set((state) => {
      const sorted = [...state.lists].sort((a, b) => a.position - b.position);
      const oldIdx = sorted.findIndex((l) => l.id === listId);
      if (oldIdx === -1) return {};
      const reordered = [...sorted];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newPosition, 0, moved);
      return {
        lists: reordered.map((l, i) => ({ ...l, position: i })),
      };
    }),

  // Members
  addMember: (member) =>
    set((state) => ({
      members: state.members.some(m => m.id === member.id) // deduplication logic
        ? state.members
        : [...state.members, member],
    })),
  removeMember: (userId) =>
    set((state) => ({ members: state.members.filter(m => m.id !== userId) })),

  // Optimistic updates
  addOptimisticCard: (card) =>
    set((state) => ({ cards: [...state.cards, card] })),

  confirmOptimisticCard: (tempId, realCard) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.tempId === tempId ? { ...realCard, isOptimistic: false } : c
      ),
    })),

  rollbackOptimisticCard: (tempId) =>
    set((state) => ({ cards: state.cards.filter((c) => c.tempId !== tempId) })),

  rollbackCardMove: (cardId, oldListId, oldPosition) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === cardId ? { ...c, listId: oldListId, position: oldPosition } : c
      ),
    })),

  // Presence
  setActiveUsers: (users) => set({ activeUsers: users }),
  addActiveUser: (user) =>
    set((state) => ({
      activeUsers: [...state.activeUsers.filter((u) => u.id !== user.id), user],
    })),
  removeActiveUser: (userId) =>
    set((state) => ({
      activeUsers: state.activeUsers.filter((u) => u.id !== userId),
    })),
  setUserAway: (userId: number, away: boolean) => set((state) => ({
    activeUsers: state.activeUsers.map(u =>
      u.id === userId ? { ...u, away } : u
    ),
  })),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      board: null,
      lists: [],
      cards: [],
      members: [],
      activeUsers: [],
      userRole: null,
      isLoading: false,
      error: null,
      connectionStatus: 'disconnected',
    }),
}));