import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  invokeTauri,
  isTauri,
  saveApiConfig,
  loadApiConfig,
  isLocalModelLoaded,
  getLocalModelInfo,
  initializeLocalModel,
  unloadLocalModel,
} from './tauriBridge';

// Mock @tauri-apps/api/core
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('tauriBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.__TAURI_INTERNALS__ which isTauri() checks first
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error -- Tauri internals are not typed on Window
    delete window.__TAURI_INTERNALS__;
  });

  describe('isTauri', () => {
    it('should return true when __TAURI_INTERNALS__ is present', () => {
      expect(isTauri()).toBe(true);
    });

    it('should return false when Tauri APIs are missing', () => {
      // @ts-expect-error -- Tauri internals are not typed on Window
      delete window.__TAURI_INTERNALS__;
      expect(isTauri()).toBe(false);
    });
  });

  describe('invokeTauri', () => {
    it('should call tauri invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue('success');

      const result = await invokeTauri('test_command', { arg: 'value' });

      expect(mockInvoke).toHaveBeenCalledWith('test_command', { arg: 'value' });
      expect(result).toBe('success');
    });

    it('should throw error when not in Tauri', async () => {
      // @ts-expect-error -- Tauri internals are not typed on Window
      delete window.__TAURI_INTERNALS__;

      await expect(invokeTauri('test')).rejects.toThrow('Web Mode');
    });

    it('should throw error with message on failure', async () => {
      mockInvoke.mockRejectedValue('Something went wrong');

      await expect(invokeTauri('test')).rejects.toThrow('Something went wrong');
    });
  });

  describe('Secure Storage', () => {
    it('should use sessionStorage in web mode', async () => {
      // @ts-expect-error -- Tauri internals are not typed on Window
      delete window.__TAURI_INTERNALS__;

      const config = { api_key: 'test', provider: 'gemini', base_url: '', model_id: '' };
      await saveApiConfig(config);

      expect(sessionStorage.getItem('ai_config_temp')).toContain('test');

      const loaded = await loadApiConfig();
      expect(loaded).toEqual(config);
    });
  });

  describe('Local model web-mode simulation', () => {
    beforeEach(async () => {
      // Force web mode (no Tauri APIs) and reset the simulated model state.
      // @ts-expect-error -- Tauri internals are not typed on Window
      delete window.__TAURI_INTERNALS__;
      await unloadLocalModel();
    });

    it('reports no model loaded initially', async () => {
      expect(await isLocalModelLoaded()).toBe(false);
      expect(await getLocalModelInfo()).toBeNull();
    });

    it('tracks the loaded model after initialize', async () => {
      await expect(initializeLocalModel('/models/test.gguf', 'llama.cpp')).resolves.toBe(true);
      expect(await isLocalModelLoaded()).toBe(true);
      expect(await getLocalModelInfo()).toEqual({ loaded: true, model_path: '/models/test.gguf' });
    });

    it('clears the loaded model after unload', async () => {
      await initializeLocalModel('/models/test.gguf', 'llama.cpp');
      await expect(unloadLocalModel()).resolves.toBe(true);
      expect(await isLocalModelLoaded()).toBe(false);
      expect(await getLocalModelInfo()).toBeNull();
    });
  });
});
