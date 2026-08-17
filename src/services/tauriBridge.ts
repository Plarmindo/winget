/**
 * Tauri Bridge Service
 *
 * Centralized IPC layer for all Tauri backend communication.
 * Provides web-mode fallbacks for development without the Tauri runtime.
 * All Tauri `invoke` calls should go through this module.
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { logger } from '../utils/logger';

/** Describes a local GGUF model discovered on disk. */
export interface LlamaModelInfo {
  name: string;
  path: string;
  size: string;
}

/**
 * Detects whether the app is running inside the Tauri desktop runtime.
 * Checks multiple Tauri-specific window properties for compatibility
 * across Tauri v1 and v2.
 */
export const isTauri = (): boolean => {
  const hasWindowProp = (prop: string): boolean =>
    typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)[prop] !== undefined;

  return hasWindowProp('__TAURI_INTERNALS__') || hasWindowProp('__TAURI_IPC__') || hasWindowProp('__TAURI__');
};

// Types for the Invoke function
type InvokeArgs = Record<string, unknown>;

export const invokeTauri = async <T>(command: string, args?: InvokeArgs): Promise<T> => {
  if (!isTauri()) {
    throw new Error('Tauri API not available. App is running in Web Mode.');
  }

  try {
    return await invoke(command, args);
  } catch (e: unknown) {
    console.error('Tauri Invoke Error:', e);
    // ... error parsing logic stays the same
    const errorStr = typeof e === 'string' ? e : e instanceof Error ? e.message : JSON.stringify(e);
    throw new Error(errorStr);
  }
};

export const executeCliSearch = async (manager: string, query: string): Promise<string> => {
  return await invokeTauri<string>('search_packages_command', { request: { manager, query } });
};

export const executeCliOperation = async (manager: string, mode: string, packages: string[]): Promise<void> => {
  return await invokeTauri<void>('run_winget_operation', { request: { manager, mode, packages } });
};

export const executeListInstalled = async (): Promise<string> => {
  return await invokeTauri<string>('list_installed_packages_command');
};

export const executeListUpgradable = async (): Promise<string> => {
  return await invokeTauri<string>('list_upgradable_packages_command');
};

export const checkIsAdmin = async (): Promise<boolean> => {
  if (!isTauri()) return false;
  return await invokeTauri<boolean>('check_is_admin');
};

// Secure Storage API
export interface SecureConfig {
  api_key: string;
  provider: string;
  base_url: string;
  model_id: string;
}

export const saveApiConfig = async (config: SecureConfig): Promise<void> => {
  if (!isTauri()) {
    // Web mode: use sessionStorage (temporary, cleared on tab close)
    sessionStorage.setItem('ai_config_temp', JSON.stringify(config));
    return;
  }
  await invokeTauri('save_api_config', { config });
};

export const loadApiConfig = async (): Promise<SecureConfig | null> => {
  if (!isTauri()) {
    const data = sessionStorage.getItem('ai_config_temp');
    return data ? JSON.parse(data) : null;
  }
  return await invokeTauri<SecureConfig | null>('load_api_config');
};

export const deleteApiConfig = async (): Promise<void> => {
  if (!isTauri()) {
    sessionStorage.removeItem('ai_config_temp');
    return;
  }
  await invokeTauri('delete_api_config');
};

// GitHub Token Secure Storage
export const saveGitHubToken = async (token: string): Promise<void> => {
  if (!isTauri()) {
    // Web mode fallback (insecure, for development only)
    sessionStorage.setItem('github_token_temp', token);
    return;
  }
  // Store GitHub token securely using keyring
  await invokeTauri('save_github_token', { token });
};

export const loadGitHubToken = async (): Promise<string | null> => {
  if (!isTauri()) {
    const token = sessionStorage.getItem('github_token_temp');
    return token;
  }
  return await invokeTauri<string | null>('load_github_token');
};

export const deleteGitHubToken = async (): Promise<void> => {
  if (!isTauri()) {
    sessionStorage.removeItem('github_token_temp');
    return;
  }
  await invokeTauri('delete_github_token');
};

export const saveScriptToDesktop = async (filename: string, content: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error('Cannot save to desktop in web mode');
  }
  return await invokeTauri<string>('save_script_to_desktop', { filename, content });
};

export const listOllamaModels = async (): Promise<string[]> => {
  // Ollama is a local HTTP service — call it directly without routing through Tauri
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (res.ok) {
      const data = await res.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    }
  } catch (e) {
    console.warn('Ollama fetch failed:', e);
  }
  return [];
};

// Updated to use llama.cpp instead of Ollama
export const listLlamaModels = async (): Promise<LlamaModelInfo[]> => {
  if (!isTauri()) {
    // Web Mode fallback: return some placeholder models
    return [
      { name: 'llama3:latest', path: './models/llama3.gguf', size: '4.7GB' },
      { name: 'mistral:latest', path: './models/mistral.gguf', size: '4.1GB' },
    ];
  }
  return await invokeTauri<LlamaModelInfo[]>('list_llama_models');
};

// Canonical local model functions (defined first so wrappers can reference them)

// Web-mode simulation state for local models. The simulated functions below must
// agree with each other: initialize() records the path, status reads it back, and
// unload() clears it. Previously initialize returned true while status always
// reported false, so the UI's "Model loaded" state flickered and the Unload
// button could vanish right after appearing.
let webModeModelPath: string | null = null;

// Check if local model is loaded
export const isLocalModelLoaded = async (): Promise<boolean> => {
  if (!isTauri()) return webModeModelPath !== null;
  return await invokeTauri<boolean>('is_local_model_loaded');
};

// Get local model info
export const getLocalModelInfo = async (): Promise<{
  loaded: boolean;
  model_path?: string;
  backend?: string;
} | null> => {
  if (!isTauri()) {
    return webModeModelPath ? { loaded: true, model_path: webModeModelPath } : null;
  }
  return await invokeTauri<{ loaded: boolean; model_path?: string; backend?: string } | null>('get_local_model_info');
};

// Initialize local model with backend selection
export const initializeLocalModel = async (modelPath: string, backend: string): Promise<boolean> => {
  if (!isTauri()) {
    webModeModelPath = modelPath;
    return true;
  }
  return await invokeTauri<boolean>('initialize_local_model', { model_path: modelPath, backend });
};

// Generate text with local model
export const generateLocalText = async (prompt: string, maxTokens?: number, temperature?: number): Promise<string> => {
  if (!isTauri()) {
    return `Simulated response to: ${prompt}`;
  }
  return await invokeTauri<string>('generate_local_text', { prompt, max_tokens: maxTokens, temperature });
};

// Canonical: unload the local model, returns boolean
export const unloadLocalModel = async (): Promise<boolean> => {
  if (!isTauri()) {
    webModeModelPath = null;
    return true;
  }
  return await invokeTauri<boolean>('unload_local_model');
};

// Legacy wrappers (delegate to canonical functions above)

export const initializeLlamaModel = async (modelPath: string): Promise<string> => {
  const ok = await initializeLocalModel(modelPath, 'llama.cpp');
  return ok ? 'Model initialized successfully' : 'Failed to initialize model';
};

export const generateText = async (prompt: string, maxTokens?: number): Promise<string> => {
  return await generateLocalText(prompt, maxTokens);
};

export const unloadLlamaModel = async (): Promise<string> => {
  await unloadLocalModel();
  return 'Model unloaded successfully';
};

// Git Operations
export const gitCloneRepo = async (url: string, destination: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error('Git clone requires desktop app');
  }
  return await invokeTauri<string>('git_clone_repo', { url, destination });
};

export const gitPullRepo = async (repoPath: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error('Git pull requires desktop app');
  }
  return await invokeTauri<string>('git_pull_repo', { repoPath });
};

export const gitRepoStatus = async (repoPath: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error('Git status requires desktop app');
  }
  return await invokeTauri<string>('git_repo_status', { repoPath });
};

export const getDocumentDir = async (): Promise<string> => {
  if (!isTauri()) return '';
  try {
    const { documentDir } = await import('@tauri-apps/api/path');
    return await documentDir();
  } catch (e) {
    console.error('Failed to get document directory:', e);
    return '';
  }
};

export const downloadAndInstall = async (url: string, filename: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error('Direct install requires desktop app');
  }
  return await invokeTauri<string>('download_and_install_command', { url, filename });
};

export const openUrl = async (url: string): Promise<void> => {
  logger.debug('[openUrl] Called with:', url);
  logger.debug('[openUrl] isTauri:', isTauri());

  if (isTauri()) {
    try {
      logger.debug('[openUrl] Using Tauri shell.open');
      await open(url);
      logger.debug('[openUrl] Tauri open succeeded');
    } catch (e) {
      console.error('[openUrl] Failed to open URL via Tauri:', e);
      logger.debug('[openUrl] Falling back to window.open');
      window.open(url, '_blank');
    }
  } else {
    logger.debug('[openUrl] Web mode - using window.open');
    window.open(url, '_blank');
  }
};

// Local LLM Model File Selection
export const selectModelFile = async (): Promise<string | null> => {
  if (!isTauri()) {
    // Web mode: return null or show a message
    console.warn('File dialog not available in web mode');
    return null;
  }
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'GGUF Models',
          extensions: ['gguf'],
        },
      ],
    });
    return (selected as string) || null;
  } catch (e) {
    console.error('Failed to open file dialog:', e);
    return null;
  }
};
