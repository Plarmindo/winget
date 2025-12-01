import { AppTheme } from './types';

export const PRESET_CATEGORIES = [
  "Development", "Gaming", "Productivity", "Utilities", "Multimedia", "System"
];

export const POPULAR_SUGGESTIONS = [
  "Google Chrome", "Mozilla Firefox", "Visual Studio Code", "Discord", "Spotify", 
  "Steam", "Git", "Node.js", "Python", "Docker Desktop", "7-Zip", "VLC Media Player", 
  "Notepad++", "Zoom", "Slack", "WhatsApp", "Telegram", "Obsidian", "PowerToys", 
  "Windows Terminal", "Adobe Acrobat Reader", "Microsoft Teams", "Postman", 
  "IntelliJ IDEA", "Android Studio", "Vim", "Neovim", "Blender", "GIMP", "Audacity",
  "OBS Studio", "Epic Games Launcher", "Dropbox", "OneDrive", "ShareX", "HandBrake"
];

export const STORAGE_KEYS = {
  CART: 'winget_cart_storage',
  SETTINGS: 'winget_app_settings',
  CHAT: 'winget_chat_history',
  MODEL_PREF: 'winget_chat_model_pref',
  SEARCH_HISTORY: 'winget_search_history'
};

export const DEFAULT_THEMES: AppTheme[] = [
  {
    id: 'default',
    name: 'Default Slate',
    colors: {
      bg: '#0f172a', // slate-900
      surface: '#1e293b', // slate-800
      border: '#334155', // slate-700
      text: '#f8fafc', // slate-50
      textMuted: '#94a3b8', // slate-400
      primary: '#2563eb', // blue-600
      primaryHover: '#3b82f6' // blue-500
    }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      bg: '#000000',
      surface: '#111111',
      border: '#333333',
      text: '#ffffff',
      textMuted: '#888888',
      primary: '#6366f1', // indigo-500
      primaryHover: '#818cf8'
    }
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    colors: {
      bg: '#0c4a6e', // sky-900
      surface: '#075985', // sky-800
      border: '#0ea5e9', // sky-500
      text: '#f0f9ff', // sky-50
      textMuted: '#bae6fd', // sky-200
      primary: '#0284c7', // sky-600
      primaryHover: '#38bdf8'
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: {
      bg: '#09090b', 
      surface: '#18181b', 
      border: '#27272a',
      text: '#e4e4e7',
      textMuted: '#a1a1aa',
      primary: '#d946ef', // fuchsia-500
      primaryHover: '#e879f9'
    }
  }
];