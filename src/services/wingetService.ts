import { GoogleGenAI, Modality } from "@google/genai";
import { WingetPackage, AppSettings, ChatModelType, PackageManagerType, AiConfig } from '../types';
import { executeCliSearch, executeCliOperation, executeListInstalled, executeListUpgradable, isTauri } from './tauriBridge';
import { searchGitHubRepos } from './githubService';

// --- Helpers ---

export const getManagerContext = (pm: PackageManagerType) => {
    switch (pm) {
        case 'winget': return { name: 'Windows Package Manager', cmd: 'winget' };
        case 'chocolatey': return { name: 'Chocolatey', cmd: 'choco' };
        case 'scoop': return { name: 'Scoop', cmd: 'scoop' };
        case 'brew': return { name: 'Homebrew', cmd: 'brew' };
        case 'apt': return { name: 'APT', cmd: 'apt' };
        case 'github': return { name: 'GitHub', cmd: 'git' };
        default: return { name: 'Package Manager', cmd: 'pkg' };
    }
};

export const detectTaskComplexity = (message: string): 'simple' | 'complex' => {
    const complexKeywords = ['script', 'compare', 'difference', 'code', 'json', 'analysis', 'explain', 'why', 'review', 'create'];
    if (message.length > 80 || complexKeywords.some(k => message.toLowerCase().includes(k))) return 'complex';
    return 'simple';
};

export const parseWingetOutput = (output: string): WingetPackage[] => {
    try {
        // Try to parse as JSON first (if the CLI command outputs JSON)
        const parsed = JSON.parse(output);
        if (Array.isArray(parsed)) return parsed;
        return [];
    } catch (e) {
        console.error("Failed to parse Winget output as JSON:", e);
        // Fallback or empty if not JSON
        return [];
    }
};

export const callOpenAICompatible = async (aiConfig: AiConfig, messages: any[], systemInstruction: string, signal?: AbortSignal): Promise<string> => {
    if (!aiConfig.baseUrl || !aiConfig.modelId) throw new Error("Invalid AI Configuration for Custom Provider");

    const finalMessages = [
        { role: 'system', content: systemInstruction },
        ...messages
    ];

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (aiConfig.apiKey) {
        headers['Authorization'] = `Bearer ${aiConfig.apiKey}`;
    }

    let response;
    try {
        response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: aiConfig.modelId,
                messages: finalMessages,
            }),
            signal
        });
    } catch (networkError) {
        throw new Error("Unable to connect to AI Provider. Please check your internet connection and Base URL.");
    }

    if (!response.ok) {
        throw new Error(`AI Request Failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
};

// --- Exported Services ---

export const searchPackages = async (query: string, _installed: WingetPackage[], settings: AppSettings, _signal?: AbortSignal): Promise<WingetPackage[]> => {
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
            // Clean up response if it contains markdown code blocks
            const cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const results = JSON.parse(cleanJson);

            if (Array.isArray(results)) {
                return results.map((pkg: any) => ({
                    ...pkg,
                    source: settings.activePackageManager // Ensure source is correct
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
        // Ensure the error is a plain string so UI can display full details
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
    // If running in browser (not Tauri), return empty
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
    // If running in browser (not Tauri), return empty
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

// --- Prompt Generators ---

export const generateAppDetailsPrompt = (name: string, id: string) => `Briefly explain what ${name} (${id}) is and its main features.`;
export const generateAlternativesPrompt = (name: string) => `List 5 best alternatives to ${name}.`;
export const generateEvaluationPrompt = (name: string) => `Evaluate ${name} based on performance, security, and user ratings.`;
export const generateComparisonPrompt = (packages: WingetPackage[]) => `Compare these packages: ${packages.map(p => p.name).join(', ')}. Return a JSON object with keys: apps (array of names), features (array of objects {name, values[]}), pros (array of objects {app, items[]}), cons (array of objects {app, items[]}), verdict (string).`;

// --- AI Interaction ---

export const generateAIResponse = async (settings: AppSettings, prompt: string, systemInstruction: string, jsonMode: boolean = false): Promise<string> => {
    if (settings.aiConfig.provider === 'gemini') {
        const apiKey = settings.aiConfig.apiKey || process.env.API_KEY;
        if (!apiKey) throw new Error("No API Key configured.");

        const ai = new GoogleGenAI({ apiKey });
        const config: any = { systemInstruction };
        if (jsonMode) config.responseMimeType = 'application/json';

        const response = await ai.models.generateContent({
            model: settings.aiConfig.modelId || 'gemini-2.5-flash',
            contents: prompt,
            config
        });
        return response.text || '';
    }

    return callOpenAICompatible(settings.aiConfig, [{ role: 'user', content: prompt }], systemInstruction);
};

export const transcribeAudio = async (base64Audio: string, mimeType: string, settings: AppSettings): Promise<string> => {
    if (settings.aiConfig.provider !== 'gemini') return "";
    const apiKey = settings.aiConfig.apiKey || process.env.API_KEY;
    if (!apiKey) return "";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Audio } },
                    { text: "Transcribe this audio exactly." }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error("Transcription error:", e);
        return "";
    }
};

export const generateSpeech = async (text: string, settings: AppSettings): Promise<string> => {
    if (settings.aiConfig.provider !== 'gemini') return "";
    const apiKey = settings.aiConfig.apiKey || process.env.API_KEY;
    if (!apiKey) return "";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                }
            }
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    } catch (e) {
        console.error("TTS error:", e);
        return "";
    }
};

export const chatWithAI = async (
    message: string,
    history: { role: string, parts: { text: string }[] }[],
    modelType: ChatModelType,
    settings: AppSettings,
    signal?: AbortSignal
) => {
    const { activePackageManager, aiConfig } = settings;
    const managerInfo = getManagerContext(activePackageManager);

    const CHAT_SYSTEM_INSTRUCTION = `
You are an expert, helpful assistant for the ${managerInfo.name}.
Your goal is to assist users in finding, installing, upgrading, and removing software on using ${managerInfo.cmd}.

**Response Guidelines:**
1. **Formatting:** Use standard Markdown. Use bold for package names and code blocks for commands.
2. **Comparisons:** When asked to compare packages, **YOU MUST** use a strict Markdown Table format to present features side-by-side. 
   - The first column must be the Feature Name (e.g., License, Price, Platform).
   - Subsequent columns must be the App Names.
   - Use concise text in cells.
   - **DO NOT** output a JSON block for comparisons, only the table.
   Example Table:
   | Feature | App A | App B |
   | --- | --- | --- |
   | License | Open Source | Paid |
   | OS | Windows | Multi-platform |
   
3. **Commands:** When suggesting commands, use code blocks (e.g., \`${managerInfo.cmd} <id>\`).
4. **Package Lists:** ONLY if asked to find/search/recommend apps to install, include a structured JSON array at the very end of your response in a \`\`\`json\`\`\` block.
   - The JSON **MUST** be an array of objects with these exact fields:
     - \`id\`: The package ID (e.g., "Microsoft.VisualStudioCode")
     - \`name\`: The full name (e.g., "Visual Studio Code")
     - \`description\`: A short description
     - \`source\`: "${managerInfo.cmd}"
   
   Example JSON:
   \`\`\`json
   [
     { "id": "Mozilla.Firefox", "name": "Mozilla Firefox", "description": "Fast, private browser.", "source": "winget" }
   ]
   \`\`\`

5. **Context:** You are currently configured for **${managerInfo.name}**. Do not provide commands for other package managers unless asked.
`;

    // If Provider is Gemini
    if (aiConfig.provider === 'gemini') {
        const apiKey = aiConfig.apiKey || process.env.API_KEY;
        if (!apiKey) throw new Error("No API Key. Check Settings.");

        const ai = new GoogleGenAI({ apiKey });

        let modelName = aiConfig.modelId || 'gemini-2.5-flash';
        let thinkingConfig = undefined;

        const isDefaultModelConfig = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-pro-preview', 'gemini-2.0-flash-exp'].some(m => aiConfig.modelId?.includes(m));

        if (isDefaultModelConfig || !aiConfig.modelId) {
            if (modelType === 'fast') modelName = 'gemini-2.5-flash-lite';
            else if (modelType === 'balanced') modelName = 'gemini-2.5-flash';
            else if (modelType === 'smart') modelName = 'gemini-2.0-flash-exp';
            else if (modelType === 'thinking') {
                modelName = 'gemini-2.0-flash-thinking-exp-1219';
                thinkingConfig = { thinkingBudget: 16384 };
            }
        }

        const complexity = detectTaskComplexity(message);
        if (complexity === 'complex' && modelType === 'balanced' && ['gemini-2.5-flash'].includes(modelName)) {
            console.log("Auto-upgrading Chat model to Pro for complex task");
            modelName = 'gemini-2.0-flash-exp';
        }

        const createChatAndSend = async (useSearch: boolean) => {
            const config: any = {
                systemInstruction: CHAT_SYSTEM_INSTRUCTION,
                thinkingConfig
            };

            if (useSearch) {
                config.tools = [{ googleSearch: {} }];
            }

            const chat = ai.chats.create({
                model: modelName,
                history: history,
                config
            });

            return await chat.sendMessage({ message });
        };

        try {
            const result = await createChatAndSend(true);

            const sources = result.candidates?.[0]?.groundingMetadata?.groundingChunks
                ?.map((chunk: any) => ({
                    uri: chunk.web?.uri,
                    title: chunk.web?.title || 'Source Link'
                }))
                .filter((s: any) => s.uri) || [];

            return { text: result.text || "No response text.", sources };

        } catch (error: any) {
            const errStr = error.message || JSON.stringify(error);
            const isSearchQuotaError = errStr.includes('search_grounding_request_per_project_per_day_per_user') ||
                errStr.includes('RESOURCE_EXHAUSTED');

            if (isSearchQuotaError) {
                console.warn("Chat Search Quota Exceeded. Retrying without search.");
                try {
                    const retryResult = await createChatAndSend(false);
                    return { text: retryResult.text || "No response text. (Search disabled due to quota)", sources: [] };
                } catch (retryError: any) {
                    throw new Error("Chat failed even after disabling search: " + (retryError.message || 'Unknown error'));
                }
            }
            throw error;
        }
    }

    // Generic Provider (OpenAI/Ollama)
    const messages = history.map(h => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.parts[0].text
    }));
    messages.push({ role: 'user', content: message });

    const text = await callOpenAICompatible(aiConfig, messages, CHAT_SYSTEM_INSTRUCTION, signal);
    return { text, sources: [] };
};
