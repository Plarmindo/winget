import { describe, it, expect } from 'vitest';
import {
  generateAppDetailsPrompt,
  generateAlternativesPrompt,
  generateEvaluationPrompt,
  generateComparisonPrompt,
  getChatSystemInstruction,
} from './promptService';
import { WingetPackage } from '../types';

describe('promptService', () => {
  describe('generateAppDetailsPrompt', () => {
    it('should generate a prompt with app name and id', () => {
      const result = generateAppDetailsPrompt('Visual Studio Code', 'Microsoft.VisualStudioCode');
      expect(result).toContain('Visual Studio Code');
      expect(result).toContain('Microsoft.VisualStudioCode');
      expect(result).toContain('features');
    });
  });

  describe('generateAlternativesPrompt', () => {
    it('should generate a prompt asking for alternatives', () => {
      const result = generateAlternativesPrompt('Chrome');
      expect(result).toContain('Chrome');
      expect(result).toContain('alternatives');
    });
  });

  describe('generateEvaluationPrompt', () => {
    it('should generate a prompt for app evaluation', () => {
      const result = generateEvaluationPrompt('Firefox');
      expect(result).toContain('Firefox');
      expect(result).toContain('performance');
      expect(result).toContain('security');
    });
  });

  describe('generateComparisonPrompt', () => {
    it('should generate a prompt with all package names', () => {
      const packages: WingetPackage[] = [
        { id: '1', name: 'Chrome', version: '1.0' },
        { id: '2', name: 'Firefox', version: '2.0' },
        { id: '3', name: 'Edge', version: '3.0' },
      ];

      const result = generateComparisonPrompt(packages);
      expect(result).toContain('Chrome');
      expect(result).toContain('Firefox');
      expect(result).toContain('Edge');
      expect(result).toContain('Compare');
    });

    it('should request JSON format with specific keys', () => {
      const packages: WingetPackage[] = [
        { id: '1', name: 'App1' },
        { id: '2', name: 'App2' },
      ];

      const result = generateComparisonPrompt(packages);
      expect(result).toContain('JSON');
      expect(result).toContain('features');
      expect(result).toContain('pros');
      expect(result).toContain('cons');
      expect(result).toContain('verdict');
    });
  });

  describe('getChatSystemInstruction', () => {
    it('should include manager name and command', () => {
      const result = getChatSystemInstruction('Windows Package Manager', 'winget');
      expect(result).toContain('Windows Package Manager');
      expect(result).toContain('winget');
    });

    it('should include formatting guidelines', () => {
      const result = getChatSystemInstruction('Test Manager', 'test');
      expect(result).toContain('Markdown');
      expect(result).toContain('Table');
      expect(result).toContain('JSON');
    });

    it('should not include JSON for comparisons directive', () => {
      const result = getChatSystemInstruction('Test Manager', 'test');
      expect(result).toContain('DO NOT');
      expect(result).toContain('comparison');
    });
  });
});
