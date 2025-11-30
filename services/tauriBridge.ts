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
  } catch (e) {
    console.error("Tauri Invoke Error:", e);
    throw e;
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
