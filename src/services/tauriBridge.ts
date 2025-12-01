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

    // Check if it's a structured WingetError (JSON string)
    if (typeof e === 'string') {
      try {
        // Try to parse as JSON first
        if (e.trim().startsWith('{')) {
          const parsed = JSON.parse(e);
          if (parsed.type && parsed.details) {
            // It's a structured error
            const error: any = new Error(parsed.details.message || e);
            error.code = parsed.type;
            error.details = parsed.details;
            throw error;
          }
        }
      } catch (parseError) {
        // Not JSON, fall through to string handling
      }
      throw new Error(e);
    } else if (e.message) {
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
