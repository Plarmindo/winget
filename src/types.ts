
export interface WingetPackage {
  id: string;
  name: string;
  description?: string;
  publisher?: string;
  category?: string;
  version?: string;
  availableVersion?: string;
  isFree?: boolean; // True = Free/Open Source, False = Paid/Freemium/Trial
  stars?: number;
  forks?: number;
  source?: string;
  releaseType?: 'binary' | 'source' | 'none'; // For GitHub repos: binary=has .exe/.msi, source=only source files, none=no releases
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

export type ChatModelType = 'fast' | 'balanced' | 'smart' | 'thinking';

export type AppMode = 'install' | 'upgrade' | 'uninstall' | 'github';

export type GitHubAction = 'star' | 'unstar' | 'fork' | 'open' | 'watch' | 'unwatch' | 'details' | 'clone';

export type PackageManagerType = 'winget' | 'chocolatey' | 'scoop' | 'brew' | 'apt' | 'github';

export type AiProviderType = 'gemini' | 'openai' | 'ollama' | 'lmstudio' | 'custom';

export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  baseUrl: string;
  modelId: string;
}

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
  compactMode: boolean;
  defaultModel: ChatModelType; // Legacy setting, kept for compatibility
  activeThemeId: string;
  themes: AppTheme[];
  customSubjects: string[];
  itemsPerPage: number;
  activePackageManager: PackageManagerType;
  aiConfig: AiConfig;
  githubToken: string;
}

export type WingetErrorCode =
  | 'INSUFFICIENT_PRIVILEGES'
  | 'PACKAGE_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'
  | 'NOT_IMPLEMENTED'
  | 'COMMAND_FAILED'
  | 'PARSE_ERROR'
  | 'UNKNOWN_ERROR';

export interface WingetError {
  type: WingetErrorCode;
  details: any;
  message?: string; // Helper for simple display
}

export interface ProgressEvent {
  operation: string;
  package: string;
  percent: number;
  message: string;
}
