// This file abstracts the Tauri API
// It safely handles cases where the app is running in a standard web browser (non-Tauri)

export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Types for the Invoke function
type InvokeArgs = Record<string, unknown>;

export const invokeTauri = async <T>(command: string, args?: InvokeArgs): Promise<T> => {
  if (!isTauri()) {
    throw new Error("Tauri API not available. App is running in Web Mode.");
  }

  // Dynamically import to avoid build errors in pure web environment
  try {
    // @ts-ignore
    const { invoke } = window.__TAURI__.tauri;
    return await invoke(command, args);
  } catch (e: any) {
    console.error("Tauri Invoke Error:", e);
    console.error("Caught error type:", typeof e);
    console.error("Caught error content:", e);

    // Helper to try parsing JSON error
    const tryParseError = (errorStr: string) => {
      try {
        if (errorStr.trim().startsWith('{')) {
          const parsed = JSON.parse(errorStr);
          if (parsed.type && parsed.details) {
            const error: any = new Error(parsed.details.message || errorStr);
            error.code = parsed.type;
            error.details = parsed.details;
            return error;
          }
        }
      } catch (parseError) {
        // Ignore
      }
      return null;
    };

    // Check if it's a structured WingetError (JSON string)
    if (typeof e === 'string') {
      const structured = tryParseError(e);
      if (structured) throw structured;
      throw new Error(e);
    } else if (e.message) {
      // Also try to parse message as JSON, in case the error was wrapped
      const structured = tryParseError(e.message);
      if (structured) throw structured;

      throw new Error(`Backend Error: ${e.message}`);
    } else {
      throw new Error("An unexpected error occurred in the backend.");
    }
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
  if (!isTauri()) {
    // Web Mode fallback: try localhost API
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      if (res.ok) {
        const data = await res.json();
        return data.models?.map((m: any) => m.name) || [];
      }
    } catch (e) {
      console.warn("Web Mode Ollama fetch failed:", e);
    }
    return [];
  }
  return await invokeTauri<string[]>('list_ollama_models');
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
    // @ts-ignore
    return await window.__TAURI__.path.documentDir();
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
  if (isTauri()) {
    try {
      // @ts-ignore
      await window.__TAURI__.shell.open(url);
    } catch (e) {
      console.error("Failed to open URL:", e);
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
};
