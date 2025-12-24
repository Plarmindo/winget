import { WingetPackage, AppSettings, PackageManagerType } from '../types';
import { executeCliSearch, executeCliOperation, executeListInstalled, executeListUpgradable, isTauri } from './tauriBridge';
import { searchGitHubRepos } from './githubService';
import { logger } from '../utils/logger';

// Re-export from aiService for backward compatibility
export {
    generateAIResponse,
    chatWithAI,
    transcribeAudio,
    generateSpeech,
    callOpenAICompatible,
    detectTaskComplexity,
    getManagerContext
} from './aiService';

// Re-export from promptService for backward compatibility
export {
    generateAppDetailsPrompt,
    generateAlternativesPrompt,
    generateEvaluationPrompt,
    generateComparisonPrompt
} from './promptService';

// Import for internal use
import { generateAIResponse } from './aiService';

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

// --- Package Search & Operations ---

export const searchPackages = async (
    query: string,
    _installed: WingetPackage[],
    settings: AppSettings,
    _signal?: AbortSignal
): Promise<WingetPackage[]> => {
    if (settings.activePackageManager === 'github') {
        return searchGitHubRepos(query, settings.githubToken);
    }

    // If running in browser (not Tauri), use AI to simulate search
    if (!isTauri()) {
        console.log(`Web Mode: Using AI to search ${settings.activePackageManager} for "${query}"`);

        // MOCK FOR HELP VIDEO RECORDING
        if (query.toLowerCase() === 'chrome') {
            return [{
                id: 'Google.Chrome',
                name: 'Google Chrome',
                version: '120.0.6099.109',
                description: 'The fast, secure, and free browser built for the modern web.',
                source: settings.activePackageManager
            }];
        }

        const prompt = `
    Search for "${query}" packages available in the "${settings.activePackageManager}" package manager.
    Return a strict JSON array of objects. Each object must have these fields:
    - id: string (package identifier)
    - name: string (package name)
    - version: string (latest version)
    - description: string (short description)
    - source: string (must be "${settings.activePackageManager}")
    
    Limit to 12 results.
    Ensure the response is ONLY valid JSON. No markdown formatting or explanations.
    `;

        try {
            const aiResponse = await generateAIResponse(settings, prompt, "You are a package manager search assistant. Output strict JSON only.", true);
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const results = JSON.parse(cleanJson);

            if (Array.isArray(results)) {
                return results.map((pkg: any) => ({
                    ...pkg,
                    source: settings.activePackageManager
                }));
            }
            return [];
        } catch (e) {
            console.error("AI Search failed:", e);
            throw new Error(`Failed to fetch results via AI. ${settings.aiConfig.provider === 'ollama' ? 'Check if Ollama is running.' : 'Check your API Key and Settings.'}`);
        }
    }

    try {
        const result = await executeCliSearch(settings.activePackageManager, query);
        return parseWingetOutput(result);
    } catch (e) {
        console.error("CLI Search failed:", e);
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
    if (!isTauri()) {
        console.warn("List installed is not available in browser mode.");
        return [];
    }

    try {
        const result = await executeListInstalled();
        return parseWingetOutput(result);
    } catch (e) {
        console.error("List installed failed:", e);
        throw e instanceof Error ? e.message : e;
    }
};

export const listUpgradablePackages = async (): Promise<WingetPackage[]> => {
    if (!isTauri()) {
        console.warn("List upgradable is not available in browser mode.");
        return [];
    }

    try {
        const result = await executeListUpgradable();
        return parseWingetOutput(result);
    } catch (e) {
        console.error("List upgradable failed:", e);
        throw e instanceof Error ? e.message : e;
    }
};
