import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchPackages } from './wingetService';
import * as tauriBridge from './tauriBridge';
import * as githubService from './githubService';
import * as aiService from './aiService';
import { AppSettings } from '../types';

// Mock dependencies
vi.mock('./tauriBridge', () => ({
  executeCliSearch: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock('./githubService', () => ({
  searchGitHubRepos: vi.fn().mockResolvedValue([]),
}));

vi.mock('./aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./aiService')>();
  return {
    ...actual,
    generateAIResponse: vi.fn(),
  };
});

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

    providers.forEach((provider) => {
      it(`should execute CLI search for ${provider}`, async () => {
        const settings = { ...mockSettings, activePackageManager: provider as any };
        await searchPackages('test-query', settings);
        expect(tauriBridge.executeCliSearch).toHaveBeenCalledWith(provider, 'test-query');
      });
    });

    it('should use GitHub service for github provider', async () => {
      const settings = { ...mockSettings, activePackageManager: 'github' as any };
      await searchPackages('test-query', settings);
      expect(githubService.searchGitHubRepos).toHaveBeenCalledWith('test-query', '');
      expect(tauriBridge.executeCliSearch).not.toHaveBeenCalled();
    });
  });

  describe('Web Mode (Browser)', () => {
    beforeEach(() => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
    });

    const systemProviders = ['winget', 'chocolatey', 'scoop', 'brew', 'apt'];

    systemProviders.forEach((provider) => {
      it(`should search via the AI provider for ${provider}`, async () => {
        const settings = { ...mockSettings, activePackageManager: provider as any };
        const aiPackages = [
          { id: 'Test.App', name: 'Test App', version: '1.0.0', description: 'A test app', source: provider },
        ];
        vi.mocked(aiService.generateAIResponse).mockResolvedValue(JSON.stringify(aiPackages));

        // In web mode there is no CLI, so search runs through the configured
        // AI provider and stamps results with the active package manager.
        const results = await searchPackages('test-query', settings);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results.every((pkg) => pkg.source === provider)).toBe(true);
        expect(aiService.generateAIResponse).toHaveBeenCalled();
        expect(tauriBridge.executeCliSearch).not.toHaveBeenCalled();
      });
    });

    it('should still use GitHub service for github provider', async () => {
      const settings = { ...mockSettings, activePackageManager: 'github' as any };
      await searchPackages('test-query', settings);
      expect(githubService.searchGitHubRepos).toHaveBeenCalledWith('test-query', '');
    });
  });
});
