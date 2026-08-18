import { describe, it, expect } from 'vitest';
import { normalizeAiConfig, detectTaskComplexity, getManagerContext } from './aiService';
import { AiConfig } from '../types';

describe('aiService', () => {
  describe('normalizeAiConfig', () => {
    it('should add default Ollama baseUrl when not set', () => {
      const config: AiConfig = {
        provider: 'ollama',
        apiKey: '',
        baseUrl: '',
        modelId: 'llama2',
      };

      const result = normalizeAiConfig(config);
      expect(result.baseUrl).toBe('http://localhost:11434/v1');
    });

    it('should preserve existing baseUrl for Ollama', () => {
      const config: AiConfig = {
        provider: 'ollama',
        apiKey: '',
        baseUrl: 'http://custom:8000/v1',
        modelId: 'llama2',
      };

      const result = normalizeAiConfig(config);
      expect(result.baseUrl).toBe('http://custom:8000/v1');
    });

    it('should default the Gemini base URL to the OpenAI-compatible endpoint', () => {
      const config: AiConfig = {
        provider: 'gemini',
        apiKey: 'test-key',
        baseUrl: '',
        modelId: 'gemini-2.5-flash',
      };

      const result = normalizeAiConfig(config);
      expect(result.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
      expect(result.apiKey).toBe('test-key');
    });

    it('should preserve an explicitly set Gemini base URL', () => {
      const config: AiConfig = {
        provider: 'gemini',
        apiKey: 'test-key',
        baseUrl: 'https://custom.example.com/v1',
        modelId: 'gemini-2.5-flash',
      };

      const result = normalizeAiConfig(config);
      expect(result.baseUrl).toBe('https://custom.example.com/v1');
    });
  });

  describe('detectTaskComplexity', () => {
    it('should return "simple" for short messages', () => {
      expect(detectTaskComplexity('install chrome')).toBe('simple');
      expect(detectTaskComplexity('list apps')).toBe('simple');
    });

    it('should return "complex" for long messages', () => {
      const longMessage =
        'This is a very long message that contains a lot of words and should definitely be classified as complex because it exceeds 80 characters';
      expect(detectTaskComplexity(longMessage)).toBe('complex');
    });

    it('should return "complex" for messages with complex keywords', () => {
      expect(detectTaskComplexity('compare chrome and firefox')).toBe('complex');
      expect(detectTaskComplexity('explain why this works')).toBe('complex');
      expect(detectTaskComplexity('create a script')).toBe('complex');
      expect(detectTaskComplexity('analyze the code')).toBe('complex');
    });

    it('should be case insensitive for keywords', () => {
      expect(detectTaskComplexity('COMPARE apps')).toBe('complex');
      expect(detectTaskComplexity('Compare Apps')).toBe('complex');
    });
  });

  describe('getManagerContext', () => {
    it('should return correct context for winget', () => {
      const result = getManagerContext('winget');
      expect(result).toEqual({ name: 'Windows Package Manager', cmd: 'winget' });
    });

    it('should return correct context for chocolatey', () => {
      const result = getManagerContext('chocolatey');
      expect(result).toEqual({ name: 'Chocolatey', cmd: 'choco' });
    });

    it('should return correct context for scoop', () => {
      const result = getManagerContext('scoop');
      expect(result).toEqual({ name: 'Scoop', cmd: 'scoop' });
    });

    it('should return correct context for brew', () => {
      const result = getManagerContext('brew');
      expect(result).toEqual({ name: 'Homebrew', cmd: 'brew' });
    });

    it('should return correct context for apt', () => {
      const result = getManagerContext('apt');
      expect(result).toEqual({ name: 'APT', cmd: 'apt' });
    });

    it('should return correct context for github', () => {
      const result = getManagerContext('github');
      expect(result).toEqual({ name: 'GitHub', cmd: 'git' });
    });

    it('should return default context for unknown manager', () => {
      // @ts-expect-error - Testing invalid input
      const result = getManagerContext('unknown');
      expect(result).toEqual({ name: 'Package Manager', cmd: 'pkg' });
    });
  });
});
