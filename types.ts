export interface WingetPackage {
  id: string;
  name: string;
  description: string;
  publisher: string;
  category: string;
  version?: string;
  availableVersion?: string;
}

export interface SearchState {
  query: string;
  results: WingetPackage[];
  loading: boolean;
  error: string | null;
}

export type CartItem = WingetPackage;

export enum ViewMode {
  GRID = 'GRID',
  LIST = 'LIST'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: { uri: string; title: string }[];
  isThinking?: boolean;
  feedback?: 'up' | 'down';
}

export type ChatModelType = 'fast' | 'smart' | 'thinking';

export type AppMode = 'install' | 'upgrade' | 'uninstall';

export interface AppTheme {
  id: string;
  name: string;
  colors: {
    bg: string;          // Main background
    surface: string;     // Card/Modal background
    border: string;      // Borders
    text: string;        // Primary text
    textMuted: string;   // Secondary text
    primary: string;     // Primary action color
    primaryHover: string;// Primary hover
  };
  isCustom?: boolean;
}

export interface AppSettings {
  reducedMotion: boolean;
  highContrast: boolean;
  compactMode: boolean; // New setting for denser layout
  defaultModel: ChatModelType;
  activeThemeId: string;
  themes: AppTheme[];
  customSubjects: string[];
  itemsPerPage: number;
}
