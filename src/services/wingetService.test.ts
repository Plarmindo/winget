import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPackages, executeRealCommand } from './wingetService';
import * as tauriBridge from './tauriBridge';
import { AppSettings } from '../types';

// Mock tauriBridge
vi.mock('./tauriBridge', () => ({
    executeCliSearch: vi.fn(),
    executeCliOperation: vi.fn(),
    isTauri: vi.fn().mockReturnValue(true),
}));

// Mock githubService
vi.mock('./githubService', () => ({
    searchGitHubRepos: vi.fn().mockResolvedValue([]),
}));

describe('wingetService', () => {
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

    describe('searchPackages', () => {
        it('should parse valid JSON output from CLI', async () => {
            const mockOutput = JSON.stringify([
                { id: 'Test.App', name: 'Test App', version: '1.0.0', source: 'winget' }
            ]);

            vi.spyOn(tauriBridge, 'executeCliSearch').mockResolvedValue(mockOutput);

            const results = await searchPackages('test', [], mockSettings);

            expect(tauriBridge.executeCliSearch).toHaveBeenCalledWith('winget', 'test');
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('Test.App');
        });

        it('should handle empty or invalid JSON gracefully', async () => {
            vi.spyOn(tauriBridge, 'executeCliSearch').mockResolvedValue('Invalid JSON');

            const results = await searchPackages('test', [], mockSettings);

            expect(results).toEqual([]);
        });

        it('should use GitHub search when package manager is github', async () => {
            const githubSettings = { ...mockSettings, activePackageManager: 'github' as const };
            // Note: We'd need to mock githubService.searchGitHubRepos here if we were testing that path fully
            // For now, just ensuring it doesn't call executeCliSearch

            try {
                await searchPackages('test', [], githubSettings);
            } catch (e) {
                // Ignore errors from unmocked github service
            }

            expect(tauriBridge.executeCliSearch).not.toHaveBeenCalled();
        });
    });

    describe('executeRealCommand', () => {
        it('should call executeCliOperation with correct arguments', async () => {
            await executeRealCommand('winget', 'install', ['Test.App']);

            expect(tauriBridge.executeCliOperation).toHaveBeenCalledWith('winget', 'install', ['Test.App']);
        });

        it('should support upgrade mode', async () => {
            await executeRealCommand('winget', 'upgrade', ['Test.App']);

            expect(tauriBridge.executeCliOperation).toHaveBeenCalledWith('winget', 'upgrade', ['Test.App']);
        });

        it('should support uninstall mode', async () => {
            await executeRealCommand('winget', 'uninstall', ['Test.App']);

            expect(tauriBridge.executeCliOperation).toHaveBeenCalledWith('winget', 'uninstall', ['Test.App']);
        });
    });
});
