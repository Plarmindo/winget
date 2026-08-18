import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPackages, executeRealCommand, parseAIJsonArray } from './wingetService';
import * as tauriBridge from './tauriBridge';
import * as aiService from './aiService';
import { AppSettings } from '../types';

// Mock tauriBridge
vi.mock('./tauriBridge', () => ({
  executeCliSearch: vi.fn(),
  executeCliOperation: vi.fn(),
  isTauri: vi.fn().mockReturnValue(true),
}));

// Mock aiService (only generateAIResponse is used by wingetService)
vi.mock('./aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./aiService')>();
  return {
    ...actual,
    generateAIResponse: vi.fn(),
  };
});

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
      const mockOutput = JSON.stringify([{ id: 'Test.App', name: 'Test App', version: '1.0.0', source: 'winget' }]);

      vi.spyOn(tauriBridge, 'executeCliSearch').mockResolvedValue(mockOutput);

      const results = await searchPackages('test', mockSettings);

      expect(tauriBridge.executeCliSearch).toHaveBeenCalledWith('winget', 'test');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('Test.App');
    });

    it('should handle empty or invalid JSON gracefully', async () => {
      vi.spyOn(tauriBridge, 'executeCliSearch').mockResolvedValue('Invalid JSON');

      const results = await searchPackages('test', mockSettings);

      expect(results).toEqual([]);
    });

    it('should use GitHub search when package manager is github', async () => {
      const githubSettings = { ...mockSettings, activePackageManager: 'github' as const };
      // Note: We'd need to mock githubService.searchGitHubRepos here if we were testing that path fully
      // For now, just ensuring it doesn't call executeCliSearch

      try {
        await searchPackages('test', githubSettings);
      } catch (e) {
        // Ignore errors from unmocked github service
      }

      expect(tauriBridge.executeCliSearch).not.toHaveBeenCalled();
    });
  });

  describe('searchPackages (web mode)', () => {
    beforeEach(() => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
    });
    afterEach(() => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(true);
    });

    it('runs a real AI search and parses the JSON result when an API key is configured', async () => {
      const aiPackages = [
        { id: 'Test.App', name: 'Test App', version: '1.0.0', description: 'A test app', source: 'winget' },
      ];
      vi.mocked(aiService.generateAIResponse).mockResolvedValue(JSON.stringify(aiPackages));

      const results = await searchPackages('chrome', mockSettings);

      expect(aiService.generateAIResponse).toHaveBeenCalledWith(
        mockSettings,
        expect.stringContaining('chrome'),
        expect.any(String)
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('Test.App');
      expect(results[0].source).toBe('winget');
      expect(tauriBridge.executeCliSearch).not.toHaveBeenCalled();
    });

    it('tolerates markdown fences around the JSON in the AI response', async () => {
      vi.mocked(aiService.generateAIResponse).mockResolvedValue(
        'Here you go:\n```json\n[{"id":"Mozilla.Firefox","name":"Mozilla Firefox","version":"133.0.3","source":"winget"}]\n```'
      );

      const results = await searchPackages('firefox', mockSettings);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('Mozilla.Firefox');
      expect(results[0].source).toBe('winget');
    });

    it('throws a descriptive error when the AI search fails', async () => {
      vi.mocked(aiService.generateAIResponse).mockRejectedValue(new Error('provider down'));

      await expect(searchPackages('chrome', mockSettings)).rejects.toThrow('Failed to fetch results via AI');
    });

    it('throws a descriptive error when the AI response is not valid JSON', async () => {
      vi.mocked(aiService.generateAIResponse).mockResolvedValue('Simulated response to: chrome');

      await expect(searchPackages('chrome', mockSettings)).rejects.toThrow('Failed to fetch results via AI');
    });

    it('returns no results in web mode when no API key is configured', async () => {
      const noKeySettings = { ...mockSettings, aiConfig: { ...mockSettings.aiConfig, apiKey: '' } };

      const results = await searchPackages('chrome', noKeySettings);

      expect(results).toEqual([]);
      expect(aiService.generateAIResponse).not.toHaveBeenCalled();
    });
  });

  describe('parseAIJsonArray', () => {
    it('parses a bare JSON array', () => {
      const result = parseAIJsonArray('[{"id":"A","name":"A"}]');
      expect(result).toEqual([{ id: 'A', name: 'A' }]);
    });

    it('parses JSON wrapped in markdown code fences', () => {
      const result = parseAIJsonArray('```json\n[{"id":"A"}]\n```');
      expect(result).toEqual([{ id: 'A' }]);
    });

    it('returns null for non-JSON text', () => {
      expect(parseAIJsonArray('Simulated response to: chrome')).toBeNull();
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
