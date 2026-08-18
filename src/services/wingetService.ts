import { WingetPackage, AppSettings, PackageManagerType } from '../types';
import {
  executeCliSearch,
  executeCliOperation,
  executeListInstalled,
  executeListUpgradable,
  isTauri,
} from './tauriBridge';
import { searchGitHubRepos } from './githubService';
import { generateAIResponse } from './aiService';
import { logger } from '../utils/logger';

// Re-export from aiService for backward compatibility
export {
  generateAIResponse,
  chatWithAI,
  transcribeAudio,
  generateSpeech,
  callOpenAICompatible,
  detectTaskComplexity,
  getManagerContext,
} from './aiService';

// Re-export from promptService for backward compatibility
export {
  generateAppDetailsPrompt,
  generateAlternativesPrompt,
  generateEvaluationPrompt,
  generateComparisonPrompt,
} from './promptService';

// --- Package Parsing ---

export const parseWingetOutput = (output: string): WingetPackage[] => {
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (e) {
    logger.error('Failed to parse Winget output as JSON', e);
    return [];
  }
};

// --- Web-mode AI search ---
// In the browser there is no winget CLI or Tauri backend, so with an API key
// configured we ask the AI provider for a strict JSON array of matching
// packages (a real search against the configured model). Without an API key
// there is no provider to search with, so search returns no results and the
// UI shows a "set your API key" prompt.

const buildWebSearchPrompt = (query: string, manager: PackageManagerType): string => `
Search for "${query}" packages available in the "${manager}" package manager.
Return a strict JSON array of objects. Each object must have these fields:
- id: string (package identifier)
- name: string (package name)
- version: string (latest version)
- description: string (short description)
- source: string (must be "${manager}")

Limit to 12 results.
Ensure the response is ONLY valid JSON. No markdown formatting or explanations.
`;

/**
 * Extract a JSON array from an AI response, tolerating markdown fences or
 * surrounding prose. Returns the parsed array, or null when no valid JSON
 * array is present (so callers can distinguish "no results" from "the
 * provider returned something that isn't JSON").
 */
export const parseAIJsonArray = (text: string): unknown[] | null => {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Search packages via the configured AI provider (web mode). The provider is
 * asked to return a strict JSON array; results are stamped with the active
 * package manager. Throws a descriptive error when the provider call or the
 * JSON parsing fails so the UI can surface it.
 */
export const searchPackagesWithAI = async (query: string, settings: AppSettings): Promise<WingetPackage[]> => {
  const { activePackageManager, aiConfig } = settings;
  if (aiConfig.provider === 'local-llama' || aiConfig.provider === 'local-ollama') {
    throw new Error('Local models are only available in the desktop app. Choose a cloud provider in Settings.');
  }
  const prompt = buildWebSearchPrompt(query, activePackageManager);
  try {
    const aiResponse = await generateAIResponse(
      settings,
      prompt,
      'You are a package manager search assistant. Output strict JSON only.'
    );
    const results = parseAIJsonArray(aiResponse);
    if (!results) throw new Error('AI response was not valid JSON');
    return results.map((pkg) => ({ ...(pkg as WingetPackage), source: activePackageManager }));
  } catch (e) {
    console.error('AI Search failed:', e);
    throw new Error(
      `Failed to fetch results via AI. ${aiConfig.provider === 'ollama' ? 'Check if Ollama is running.' : 'Check your API Key and Settings.'}`
    );
  }
};

// --- Package Search & Operations ---

export const searchPackages = async (
  query: string,
  settings: AppSettings,
  _signal?: AbortSignal
): Promise<WingetPackage[]> => {
  if (settings.activePackageManager === 'github') {
    return searchGitHubRepos(query, settings.githubToken);
  }

  // In the browser there is no winget CLI or Tauri backend. Without an API key
  // there is no AI provider to search with, so return no results and let the UI
  // show a "set your API key" prompt. Otherwise run a real AI-powered search.
  if (!isTauri()) {
    if (!settings.aiConfig.apiKey) return [];
    return searchPackagesWithAI(query, settings);
  }

  try {
    const result = await executeCliSearch(settings.activePackageManager, query);
    return parseWingetOutput(result);
  } catch (e) {
    console.error('CLI Search failed:', e);
    if (e instanceof Error) {
      throw e.message;
    }
    throw e;
  }
};

export const executeRealCommand = async (manager: PackageManagerType, mode: string, packages: string[]) => {
  await executeCliOperation(manager, mode, packages);
};

export const listInstalledPackages = async (): Promise<WingetPackage[]> => {
  try {
    const result = await executeListInstalled();
    return parseWingetOutput(result);
  } catch (e) {
    console.error('List installed failed:', e);
    throw e instanceof Error ? e.message : e;
  }
};

export const listUpgradablePackages = async (): Promise<WingetPackage[]> => {
  try {
    const result = await executeListUpgradable();
    return parseWingetOutput(result);
  } catch (e) {
    console.error('List upgradable failed:', e);
    throw e instanceof Error ? e.message : e;
  }
};
