import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

export const isTauri = (): boolean => {
  const hasTauriInternals = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
  const hasTauriIpc = typeof window !== 'undefined' && (window as any).__TAURI_IPC__ !== undefined;
  const hasTauriLegacy = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

  const result = hasTauriInternals || hasTauriIpc || hasTauriLegacy;

  // Debug logging - can be removed after verification
  if (typeof window !== 'undefined' && !(window as any).__isTauriLogged) {
    console.log('[isTauri] Detection:', { hasTauriInternals, hasTauriIpc, hasTauriLegacy, result });
    (window as any).__isTauriLogged = true;
  }

  return result;
};

// Types for the Invoke function
type InvokeArgs = Record<string, unknown>;

export const invokeTauri = async <T>(command: string, args?: InvokeArgs): Promise<T> => {
  if (!isTauri()) {
    throw new Error("Tauri API not available. App is running in Web Mode.");
  }

  try {
    return await invoke(command, args);
  } catch (e: any) {
    console.error("Tauri Invoke Error:", e);
    // ... error parsing logic stays the same
    const errorStr = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
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

export const saveScriptToDesktop = async (filename: string, content: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Cannot save to desktop in web mode");
  }
  return await invokeTauri<string>('save_script_to_desktop', { filename, content });
};

export const listOllamaModels = async (): Promise<string[]> => {
  // Ollama is a local HTTP service — call it directly without routing through Tauri
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (res.ok) {
      const data = await res.json();
      return data.models?.map((m: any) => m.name) || [];
    }
  } catch (e) {
    console.warn("Ollama fetch failed:", e);
  }
  return [];
};

// Updated to use llama.cpp instead of Ollama
export const listLlamaModels = async (): Promise<any[]> => {
  if (!isTauri()) {
    // Web Mode fallback: return some placeholder models
    return [
      { name: 'llama3:latest', path: './models/llama3.gguf', size: '4.7GB' },
      { name: 'mistral:latest', path: './models/mistral.gguf', size: '4.1GB' }
    ];
  }
  return await invokeTauri<any[]>('list_llama_models');
};

export const initializeLlamaModel = async (modelPath: string): Promise<string> => {
  if (!isTauri()) {
    return "Model initialized successfully (simulated)";
  }
  return await invokeTauri<string>('initialize_llama_model', { modelPath });
};

export const generateText = async (prompt: string, maxTokens?: number): Promise<string> => {
  if (!isTauri()) {
    // Simulate text generation for web mode
    return `Simulated response to prompt: ${prompt}`;
  }
  return await invokeTauri<string>('generate_text', { prompt, maxTokens });
};

export const unloadLlamaModel = async (): Promise<string> => {
  if (!isTauri()) {
    return "Model unloaded successfully (simulated)";
  }
  return await invokeTauri<string>('unload_llama_model');
};

// Git Operations
export const gitCloneRepo = async (url: string, destination: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Git clone requires desktop app");
  }
  return await invokeTauri<string>('git_clone_repo', { url, destination });
};

export const gitPullRepo = async (repoPath: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Git pull requires desktop app");
  }
  return await invokeTauri<string>('git_pull_repo', { repoPath });
};

export const gitRepoStatus = async (repoPath: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Git status requires desktop app");
  }
  return await invokeTauri<string>('git_repo_status', { repoPath });
};

export const getDocumentDir = async (): Promise<string> => {
  if (!isTauri()) return '';
  try {
    const { documentDir } = await import('@tauri-apps/api/path');
    return await documentDir();
  } catch (e) {
    console.error("Failed to get document directory:", e);
    return '';
  }
};

export const downloadAndInstall = async (url: string, filename: string): Promise<string> => {
  if (!isTauri()) {
    throw new Error("Direct install requires desktop app");
  }
  return await invokeTauri<string>('download_and_install_command', { url, filename });
};

export const openUrl = async (url: string): Promise<void> => {
  console.log('[openUrl] Called with:', url);
  console.log('[openUrl] isTauri:', isTauri());

  if (isTauri()) {
    try {
      console.log('[openUrl] Using Tauri shell.open');
      await open(url);
      console.log('[openUrl] Tauri open succeeded');
    } catch (e) {
      console.error("[openUrl] Failed to open URL via Tauri:", e);
      console.log('[openUrl] Falling back to window.open');
      window.open(url, '_blank');
    }
  } else {
    console.log('[openUrl] Web mode - using window.open');
    window.open(url, '_blank');
  }
};



// Local LLM Model File Selection
export const selectModelFile = async (): Promise<string | null> => {
  if (!isTauri()) {
    // Web mode: return null or show a message
    console.warn("File dialog not available in web mode");
    return null;
  }
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{
        name: "GGUF Models",
        extensions: ["gguf"]
      }]
    });
    return selected as string || null;
  } catch (e) {
    console.error("Failed to open file dialog:", e);
    return null;
  }
};

// Check if local model is loaded
export const isLocalModelLoaded = async (): Promise<boolean> => {
  if (!isTauri()) return false;
  return await invokeTauri<boolean>('is_local_model_loaded');
};

// Get local model info
export const getLocalModelInfo = async (): Promise<{ loaded: boolean; model_path?: string; backend?: string } | null> => {
  if (!isTauri()) return null;
  return await invokeTauri<{ loaded: boolean; model_path?: string; backend?: string } | null>('get_local_model_info');
};

// Initialize local model with backend selection
export const initializeLocalModel = async (modelPath: string, backend: string): Promise<boolean> => {
  if (!isTauri()) return true;
  return await invokeTauri<boolean>('initialize_local_model', { model_path: modelPath, backend });
};

// Generate text with local model
export const generateLocalText = async (prompt: string, maxTokens?: number, temperature?: number): Promise<string> => {
  if (!isTauri()) {
    return `Simulated response to: ${prompt}`;
  }
  return await invokeTauri<string>('generate_local_text', { prompt, max_tokens: maxTokens, temperature });
};
