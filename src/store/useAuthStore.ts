// =========================================================
// AUTH STORE — Zustand
// =========================================================

import { create } from 'zustand';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  cryptoKey: CryptoKey | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAuth: (user: User, cryptoKey: CryptoKey) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  cryptoKey: null,
  isLoading: false,
  error: null,

  setAuth: (user, cryptoKey) =>
    set({ user, cryptoKey, isAuthenticated: true, error: null }),

  logout: () =>
    set({ user: null, cryptoKey: null, isAuthenticated: false, error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),
}));
