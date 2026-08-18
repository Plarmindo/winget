import { StateCreator } from 'zustand';
import { AppSettings } from '../../types';
import { DEFAULT_THEMES } from '../../constants';

export interface SettingsSlice {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const DEFAULT_SETTINGS: AppSettings = {
  reducedMotion: false,
  highContrast: false,
  compactMode: false,
  defaultModel: 'smart',
  activeThemeId: 'default',
  themes: DEFAULT_THEMES,
  customSubjects: ['Browsers', 'Communication', 'Dev Tools'],
  itemsPerPage: 6,
  activePackageManager: 'winget',
  aiConfig: {
    provider: 'local-llama',
    apiKey: '',
    baseUrl: '',
    modelId: 'llama3.gguf',
    localModelPath: './models/llama3.gguf',
  },
  // Note: githubToken removed from persisted settings for security (S1)
  // GitHub token is now stored securely via secure_storage IPC
};

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
});
