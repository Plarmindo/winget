
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings, WingetPackage, AppMode } from '../types';
import { DEFAULT_THEMES } from '../constants';

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

  error: any | null; // Allow structured WingetError or string
  setError: (error: any | null) => void;

  // Chat Integration
  pendingChatQuery: string;
  setPendingChatQuery: (query: string) => void;
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

      error: null,
      setError: (error) => set({ error }),

      // --- Chat ---
      pendingChatQuery: '',
      setPendingChatQuery: (pendingChatQuery) => set({ pendingChatQuery })
    }),
    {
      name: 'winget-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: {
          ...state.settings,
          // Exclude AI config from localStorage (stored securely via Tauri)
          aiConfig: { provider: 'gemini', apiKey: '', baseUrl: '', modelId: 'gemini-2.5-flash' },
          // Exclude GitHub token from localStorage (also sensitive)
          githubToken: ''
        },
        cart: state.cart
      }),
    }
  )
);
