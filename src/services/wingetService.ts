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

/**
 * Parses winget's ASCII table output (from `winget list` / `winget upgrade`)
 * into packages, mirroring the Rust backend's parse_winget_table: column
 * positions come from the header line and each row is sliced by those offsets.
 * Returns an empty array when the text is not a winget table.
 */
export const parseWingetTableOutput = (output: string): WingetPackage[] => {
  const lines = output.split('\n');
  if (lines.length === 0) return [];

  // Separator line: all dashes, longer than 10 chars (winget's default).
  const separatorIdx = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.length > 10 && /^-+$/.test(trimmed);
  });
  if (separatorIdx <= 0) return [];

  // winget's progress spinner uses bare \r to overwrite itself, so captured
  // output has all spinner frames on the header line; take the last segment.
  const headerRaw = lines[separatorIdx - 1];
  const header = (headerRaw.split('\r').pop() ?? headerRaw).trimStart();
  const idCol = header.indexOf('Id');
  if (idCol === -1) return [];
  const nameCol = header.indexOf('Name') === -1 ? 0 : header.indexOf('Name');
  const versionCol = header.indexOf('Version');
  const availableCol = header.indexOf('Available');
  const sourceCol = header.indexOf('Source');

  const extractCol = (line: string, start: number, end?: number): string => {
    if (start >= line.length) return '';
    const slice = end !== undefined ? line.slice(start, end) : line.slice(start);
    return slice.trim();
  };

  const packages: WingetPackage[] = [];
  for (const line of lines.slice(separatorIdx + 1)) {
    const trimmed = line.trim();
    if (
      trimmed === '' ||
      trimmed.includes('upgrades available') ||
      trimmed.includes('packages found') ||
      trimmed.includes('package(s) have version numbers')
    ) {
      continue;
    }

    const name = extractCol(line, nameCol, idCol);
    const idEnd = versionCol !== -1 ? versionCol : sourceCol !== -1 ? sourceCol : undefined;
    const id = extractCol(line, idCol, idEnd);
    const version =
      versionCol !== -1
        ? extractCol(line, versionCol, availableCol !== -1 ? availableCol : sourceCol !== -1 ? sourceCol : undefined)
        : '';
    const availableVersion =
      availableCol !== -1
        ? (() => {
            const v = extractCol(line, availableCol, sourceCol !== -1 ? sourceCol : undefined);
            return v === '' ? undefined : v;
          })()
        : undefined;
    const source =
      sourceCol !== -1
        ? (() => {
            const v = extractCol(line, sourceCol);
            return v === '' ? undefined : v;
          })()
        : undefined;

    // Skip truncated IDs — they cannot be installed as-is and would fail validation.
    if (id.endsWith('...') || id.endsWith('…')) continue;

    if (id !== '' && name !== '') {
      packages.push({ id, name, version, availableVersion, source });
    }
  }
  return packages;
};

export const parseWingetOutput = (output: string): WingetPackage[] => {
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (e) {
    // Not JSON — likely pasted `winget list`/`winget upgrade` table output
    // from the Upgrade / Bulk Uninstall flows.
    logger.debug('Not JSON, falling back to winget table parsing');
    return parseWingetTableOutput(output);
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
