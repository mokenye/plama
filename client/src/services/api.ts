import axios from 'axios';
import type { AuthResponse, BoardResponse, Board, List } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  withCredentials: true,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401s globally (token expired)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ================================
// Auth
// ================================
export const authApi = {
  register: async (data: { name: string; email: string; password: string }) => {
    const res = await api.post<AuthResponse>('/auth/register', data);
    return res.data;
  },

  login: async (data: { email: string; password: string }) => {
    const res = await api.post<AuthResponse>('/auth/login', data);
    return res.data;
  },

  me: async () => {
    const res = await api.get<{ user: AuthResponse['user'] }>('/auth/me');
    return res.data;
  },
};

// ================================
// Boards
// ================================
export const boardsApi = {
  getAll: async () => {
    const res = await api.get<{ boards: Board[] }>('/boards');
    return res.data;
  },

  create: async (data: { title: string; description?: string; background_color?: string }) => {
    const res = await api.post<{ board: Board }>('/boards', data);
    return res.data;
  },

  getById: async (boardId: number) => {
    const res = await api.get<BoardResponse>(`/boards/${boardId}`);
    return res.data;
  },

  delete: async (boardId: number) => {
    const res = await api.delete(`/boards/${boardId}`);
    return res.data;
  },
};

// ================================
// Lists
// ================================
export const listsApi = {
  create: async (boardId: number, data: { title: string }) => {
    const res = await api.post<{ list: List }>(`/boards/${boardId}/lists`, data);
    return res.data;
  },

  update: async (boardId: number, listId: number, data: { title: string }) => {
    const res = await api.patch<{ list: List }>(`/boards/${boardId}/lists/${listId}`, data);
    return res.data;
  },

  delete: async (boardId: number, listId: number) => {
    const res = await api.delete(`/boards/${boardId}/lists/${listId}`);
    return res.data;
  },

  reorder: async (boardId: number, listId: number, newPosition: number) => {
    const res = await api.patch(`/boards/${boardId}/lists/${listId}/reorder`, { position: newPosition });
    return res.data;
  },
};

// ================================
// Cards
// ================================
export const cardsApi = {
  reorder: async (boardId: number, listId: number, cardIds: number[]) => {
    const res = await api.patch(`/boards/${boardId}/lists/${listId}/cards/reorder`, { cardIds });
    return res.data;
  },
};

export default api;