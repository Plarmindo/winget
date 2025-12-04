import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invokeTauri, isTauri, saveApiConfig, loadApiConfig } from './tauriBridge';

describe('tauriBridge', () => {
    const mockInvoke = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock window.__TAURI__
        Object.defineProperty(window, '__TAURI__', {
            value: {
                tauri: {
                    invoke: mockInvoke,
                },
            },
            writable: true,
            configurable: true, // Important for cleanup
        });
    });

    afterEach(() => {
        // @ts-ignore
        delete window.__TAURI__;
    });

    describe('isTauri', () => {
        it('should return true when __TAURI__ is present', () => {
            expect(isTauri()).toBe(true);
        });

        it('should return false when __TAURI__ is missing', () => {
            // @ts-ignore
            delete window.__TAURI__;
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
            // @ts-ignore
            delete window.__TAURI__;

            await expect(invokeTauri('test')).rejects.toThrow('Web Mode');
        });

        it('should parse structured WingetError', async () => {
            const structuredError = JSON.stringify({
                type: 'INSUFFICIENT_PRIVILEGES',
                details: { message: 'Admin required' }
            });

            mockInvoke.mockRejectedValue(structuredError);

            try {
                await invokeTauri('test');
                expect(true).toBe(false); // Should not reach here
            } catch (e: any) {
                expect(e.code).toBe('INSUFFICIENT_PRIVILEGES');
                expect(e.details.message).toBe('Admin required');
            }
        });
    });

    describe('Secure Storage', () => {
        it('should use sessionStorage in web mode', async () => {
            // @ts-ignore
            delete window.__TAURI__;

            const config = { api_key: 'test', provider: 'gemini', base_url: '', model_id: '' };
            await saveApiConfig(config);

            expect(sessionStorage.getItem('ai_config_temp')).toContain('test');

            const loaded = await loadApiConfig();
            expect(loaded).toEqual(config);
        });
    });
});
