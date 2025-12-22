
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings, WingetPackage, AppMode } from '../types';
import { DEFAULT_THEMES } from '../constants';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  operation: 'install' | 'upgrade' | 'uninstall' | 'clone';
  packageId: string;
  packageName: string;
  manager: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

interface AppState {
  // Settings Slice
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;

  // Cart Slice
  cart: WingetPackage[];
  addToCart: (pkg: WingetPackage) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  isInCart: (id: string) => boolean;

  // Favorites Slice
  favorites: string[]; // Package IDs
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  // History Slice
  history: HistoryEntry[];
  addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  getRecentHistory: (limit?: number) => HistoryEntry[];

  // Comparison Slice
  compareList: WingetPackage[];
  toggleCompare: (pkg: WingetPackage) => void;
  clearCompare: () => void;

  // UI/Session Slice
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  query: string;
  setQuery: (query: string) => void;
  packages: WingetPackage[];
  setPackages: (packages: WingetPackage[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;

  // Sort/Filter
  sortBy: 'name-asc' | 'name-desc' | 'manager';
  setSortBy: (sortBy: 'name-asc' | 'name-desc' | 'manager') => void;

  error: any | null; // Allow structured WingetError or string
  setError: (error: any | null) => void;

  // Chat Integration
  pendingChatQuery: string;
  setPendingChatQuery: (query: string) => void;

  // Status Bar
  statusMessage: string | null;
  statusType: 'info' | 'success' | 'error';
  setStatusMessage: (message: string | null, type?: 'info' | 'success' | 'error') => void;

  // Chat Messages (persisted)
  chatMessages: Array<{ id: string; role: 'user' | 'model'; text: string; timestamp: number; sources?: any[] }>;
  addChatMessage: (message: { role: 'user' | 'model'; text: string; sources?: any[] }) => void;
  setChatMessages: (messages: Array<{ id: string; role: 'user' | 'model'; text: string; timestamp: number; sources?: any[] }>) => void;
  clearChatMessages: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  reducedMotion: false,
  highContrast: false,
  compactMode: false,
  defaultModel: 'smart',
  activeThemeId: 'default',
  themes: DEFAULT_THEMES,
  customSubjects: ['Browsers', 'Communication', 'Dev Tools'],
  itemsPerPage: 6,
  activePackageManager: 'winget',
  aiConfig: { provider: 'gemini', apiKey: '', baseUrl: '', modelId: 'gemini-2.5-flash' },
  githubToken: ''
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Settings ---
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

      // --- Cart ---
      cart: [],
      addToCart: (pkg) => set((state) => {
        if (state.cart.find(p => p.id === pkg.id)) return state;
        return { cart: [...state.cart, pkg] };
      }),
      removeFromCart: (id) => set((state) => ({
        cart: state.cart.filter(p => p.id !== id)
      })),
      clearCart: () => set({ cart: [] }),
      isInCart: (id) => !!get().cart.find(p => p.id === id),

      // --- Favorites ---
      favorites: [],
      history: [],
      toggleFavorite: (id) => set((state) => {
        const isFav = state.favorites.includes(id);
        return { favorites: isFav ? state.favorites.filter(fid => fid !== id) : [...state.favorites, id] };
      }),
      isFavorite: (id) => get().favorites.includes(id),

      // --- History ---
      addHistoryEntry: (entry) => {
        const newEntry: HistoryEntry = {
          ...entry,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };
        set((state) => ({
          history: [newEntry, ...state.history].slice(0, 100), // Keep last 100 entries
        }));
      },

      clearHistory: () => {
        set({ history: [] });
      },

      getRecentHistory: (limit = 10) => {
        return get().history.slice(0, limit);
      },

      // --- Comparison ---
      compareList: [],
      toggleCompare: (pkg) => set((state) => {
        const exists = state.compareList.find(p => p.id === pkg.id);
        if (exists) {
          return { compareList: state.compareList.filter(p => p.id !== pkg.id) };
        }
        return { compareList: [...state.compareList, pkg] };
      }),
      clearCompare: () => set({ compareList: [] }),

      // --- UI State ---
      mode: 'install',
      setMode: (mode) => set({ mode, packages: [], query: '', error: null, compareList: [] }),
      query: '',
      setQuery: (query) => set({ query }),
      packages: [],
      setPackages: (packages) => set({ packages }),
      loading: false,
      setLoading: (loading) => set({ loading }),

      // --- Sort/Filter ---
      sortBy: 'name-asc',
      setSortBy: (sortBy) => set({ sortBy }),

      error: null,
      setError: (error) => set({ error }),

      // --- Chat ---
      pendingChatQuery: '',
      setPendingChatQuery: (pendingChatQuery) => set({ pendingChatQuery }),

      // --- Status Bar ---
      statusMessage: null,
      statusType: 'info',
      setStatusMessage: (message, type = 'info') => set({ statusMessage: message, statusType: type }),

      // --- Chat Messages ---
      chatMessages: [],
      addChatMessage: (message) => set((state) => ({
        chatMessages: [...state.chatMessages, {
          id: Date.now().toString() + Math.random(),
          ...message,
          timestamp: Date.now()
        }]
      })),
      setChatMessages: (messages) => set({ chatMessages: messages }),
      clearChatMessages: () => set({ chatMessages: [] })
    }),
    {
      name: 'winget-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        cart: state.cart,
        favorites: state.favorites,
        history: state.history,
        sortBy: state.sortBy,
        chatMessages: state.chatMessages,
      }),
    }
  )
);
