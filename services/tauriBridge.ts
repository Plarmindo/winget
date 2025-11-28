
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

export const executeCliCommand = async (manager: string, args: string[]): Promise<string> => {
  return await invokeTauri<string>('execute_cli_command', { manager, args });
};

export const spawnTerminalCommand = async (manager: string, args: string[]): Promise<void> => {
  return await invokeTauri<void>('spawn_terminal_command', { manager, args });
};
