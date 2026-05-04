import { GoogleGenAI, Modality } from "@google/genai";
import { AppSettings, ChatModelType, AiConfig, PackageManagerType } from '../types';
import { logger } from '../utils/logger';
import { getChatSystemInstruction } from './promptService';

// --- Helpers ---

/**
 * Normalize AI config with provider-specific defaults
 */
export const normalizeAiConfig = (aiConfig: AiConfig): AiConfig => {
    const normalized = { ...aiConfig };

    // Apply default baseUrl for Ollama if not set
    if (aiConfig.provider === 'ollama' && !aiConfig.baseUrl) {
        normalized.baseUrl = 'http://localhost:11434/v1';
    }

    return normalized;
};

/**
 * Detect task complexity for model selection
 */
export const detectTaskComplexity = (message: string): 'simple' | 'complex' => {
    const complexKeywords = ['script', 'compare', 'difference', 'code', 'json', 'analysis', 'explain', 'why', 'review', 'create'];
    if (message.length > 80 || complexKeywords.some(k => message.toLowerCase().includes(k))) return 'complex';
    return 'simple';
};

/**
 * Get manager context for prompts
 */
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

// --- OpenAI Compatible API ---

/**
 * Call OpenAI-compatible API (works with Ollama, LMStudio, etc.)
 */
export const callOpenAICompatible = async (
    aiConfig: AiConfig,
    messages: any[],
    systemInstruction: string,
    signal?: AbortSignal
): Promise<string> => {
    const normalizedConfig = normalizeAiConfig(aiConfig);

    if (!normalizedConfig.baseUrl || !normalizedConfig.modelId) {
        throw new Error("Invalid AI Configuration for Custom Provider");
    }

    const finalMessages = [
        { role: 'system', content: systemInstruction },
        ...messages
    ];

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (normalizedConfig.apiKey) {
        headers['Authorization'] = `Bearer ${normalizedConfig.apiKey}`;
    }

    let response;
    try {
        response = await fetch(`${normalizedConfig.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: normalizedConfig.modelId,
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

// --- Gemini-specific functions ---

/**
 * Generate a simple AI response
 */
export const generateAIResponse = async (
    settings: AppSettings,
    prompt: string,
    systemInstruction: string,
    jsonMode: boolean = false
): Promise<string> => {
    if (settings.aiConfig.provider === 'gemini') {
        const apiKey = settings.aiConfig.apiKey || import.meta.env.VITE_API_KEY;
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

/**
 * Transcribe audio using Gemini
 */
export const transcribeAudio = async (
    base64Audio: string,
    mimeType: string,
    settings: AppSettings
): Promise<string> => {
    if (settings.aiConfig.provider !== 'gemini') return "";
    const apiKey = settings.aiConfig.apiKey || import.meta.env.VITE_API_KEY;
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

/**
 * Generate speech using Gemini TTS
 */
export const generateSpeech = async (
    text: string,
    settings: AppSettings
): Promise<string> => {
    if (settings.aiConfig.provider !== 'gemini') return "";
    const apiKey = settings.aiConfig.apiKey || import.meta.env.VITE_API_KEY;
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

/**
 * Chat with AI - handles both Gemini and OpenAI-compatible providers
 */
export const chatWithAI = async (
    message: string,
    history: { role: string, parts: { text: string }[] }[],
    modelType: ChatModelType,
    settings: AppSettings,
    signal?: AbortSignal
) => {
    const { activePackageManager, aiConfig } = settings;
    const managerInfo = getManagerContext(activePackageManager);
    const CHAT_SYSTEM_INSTRUCTION = getChatSystemInstruction(managerInfo.name, managerInfo.cmd);

    // If Provider is Gemini
    if (aiConfig.provider === 'gemini') {
        const apiKey = aiConfig.apiKey || import.meta.env.VITE_API_KEY;
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
            logger.debug('Auto-upgrading Chat model to Pro for complex task');
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
