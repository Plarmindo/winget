import { useEffect } from 'react';
import { AppSettings, AppTheme } from '../types';

// Default themes fallback
const DEFAULT_THEMES: AppTheme[] = [
  {
    id: 'dark',
    name: 'Dark',
    colors: {
      bg: '#0f172a',
      surface: '#1e293b',
      border: '#334155',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
    },
  },
];

export const useThemeSync = (settings: AppSettings) => {
  useEffect(() => {
    const activeTheme = settings.themes.find((t) => t.id === settings.activeThemeId) || DEFAULT_THEMES[0];
    if (activeTheme && activeTheme.colors) {
      const root = document.documentElement;
      root.style.setProperty('--app-bg', activeTheme.colors.bg);
      root.style.setProperty('--app-surface', activeTheme.colors.surface);
      root.style.setProperty('--app-border', activeTheme.colors.border);
      root.style.setProperty('--app-text', activeTheme.colors.text);
      root.style.setProperty('--app-text-muted', activeTheme.colors.textMuted);
      root.style.setProperty('--app-primary', activeTheme.colors.primary);
      root.style.setProperty('--app-primary-hover', activeTheme.colors.primaryHover);
    }
  }, [settings.activeThemeId, settings.themes]);
};
