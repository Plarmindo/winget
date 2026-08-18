import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Import slice types and creators
import { SettingsSlice, createSettingsSlice, DEFAULT_SETTINGS } from './slices/settingsSlice';
import { CartSlice, createCartSlice } from './slices/cartSlice';
import { ChatSlice, createChatSlice } from './slices/chatSlice';
import { UiSlice, createUiSlice, HistoryEntry, SortByType } from './slices/uiSlice';

// Re-export for backward compatibility
export type { HistoryEntry, SortByType };
export { DEFAULT_SETTINGS };

// Combined app state type
export type AppState = SettingsSlice & CartSlice & ChatSlice & UiSlice;

// Create the combined store with slices
export const useAppStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createSettingsSlice(...args),
      ...createCartSlice(...args),
      ...createChatSlice(...args),
      ...createUiSlice(...args),
    }),
    {
      name: 'winget-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // S2: Exclude aiConfig.apiKey from localStorage (stored securely in OS keychain)
        settings: {
          ...state.settings,
          aiConfig: state.settings.aiConfig
            ? {
                provider: state.settings.aiConfig.provider,
                baseUrl: state.settings.aiConfig.baseUrl,
                modelId: state.settings.aiConfig.modelId,
                localModelPath: state.settings.aiConfig.localModelPath,
                // apiKey excluded - stored in secure_storage
              }
            : state.settings.aiConfig,
        },
        cart: state.cart,
        favorites: state.favorites,
        history: state.history,
        sortBy: state.sortBy,
        chatMessages: state.chatMessages,
      }),
    }
  )
);
