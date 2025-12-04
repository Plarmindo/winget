import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPackages } from './wingetService';
import * as tauriBridge from './tauriBridge';
import * as githubService from './githubService';
import { AppSettings } from '../types';

// Mock dependencies
vi.mock('./tauriBridge', () => ({
    executeCliSearch: vi.fn(),
    isTauri: vi.fn(),
}));

vi.mock('./githubService', () => ({
    searchGitHubRepos: vi.fn().mockResolvedValue([]),
}));

describe('Provider Integration Tests', () => {
    const mockSettings: AppSettings = {
        reducedMotion: false,
        highContrast: false,
        compactMode: false,
        defaultModel: 'balanced',
        activeThemeId: 'default',
        themes: [],
        customSubjects: [],
        itemsPerPage: 10,
        activePackageManager: 'winget',
        aiConfig: { provider: 'gemini', apiKey: 'test', baseUrl: '', modelId: '' },
        githubToken: '',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Desktop Mode (Tauri)', () => {
        beforeEach(() => {
            vi.mocked(tauriBridge.isTauri).mockReturnValue(true);
            vi.mocked(tauriBridge.executeCliSearch).mockResolvedValue('[]');
        });

        const providers = ['winget', 'chocolatey', 'scoop', 'brew', 'apt'];

        providers.forEach(provider => {
            it(`should execute CLI search for ${provider}`, async () => {
                const settings = { ...mockSettings, activePackageManager: provider as any };
                await searchPackages('test-query', [], settings);
                expect(tauriBridge.executeCliSearch).toHaveBeenCalledWith(provider, 'test-query');
            });
        });

        it('should use GitHub service for github provider', async () => {
            const settings = { ...mockSettings, activePackageManager: 'github' as any };
            await searchPackages('test-query', [], settings);
            expect(githubService.searchGitHubRepos).toHaveBeenCalledWith('test-query', '');
            expect(tauriBridge.executeCliSearch).not.toHaveBeenCalled();
        });
    });

    describe('Web Mode (Browser)', () => {
        beforeEach(() => {
            vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
            // Mock GoogleGenAI via a global mock or spy if possible, but since it's hard to mock internal calls in same file without refactor,
            // we will assume the AI call fails (missing API key in mock) or returns empty if we can't easily mock it.
            // However, we CAN mock the fetch call if it uses `callOpenAICompatible` or we can mock the `GoogleGenAI` constructor.
        });

        const systemProviders = ['winget', 'chocolatey', 'scoop', 'brew', 'apt'];

        systemProviders.forEach(provider => {
            it(`should attempt AI search for ${provider}`, async () => {
                const settings = { ...mockSettings, activePackageManager: provider as any };

                // We expect it to fail or return empty because we haven't mocked the AI response fully,
                // but we want to ensure it does NOT return empty immediately (it should try AI).
                // Actually, let's mock the console.log to verify it tries AI.
                const consoleSpy = vi.spyOn(console, 'log');

                try {
                    await searchPackages('test-query', [], settings);
                } catch (e) {
                    // It might throw due to missing API key or mock failure, which is fine for this test
                    // as long as it tried.
                }

                expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Web Mode: Using AI to search'));
                expect(tauriBridge.executeCliSearch).not.toHaveBeenCalled();
            });
        });

        it('should still use GitHub service for github provider', async () => {
            const settings = { ...mockSettings, activePackageManager: 'github' as any };
            await searchPackages('test-query', [], settings);
            expect(githubService.searchGitHubRepos).toHaveBeenCalledWith('test-query', '');
        });
    });
});
