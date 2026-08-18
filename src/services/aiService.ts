import { AppSettings, ChatModelType, AiConfig, PackageManagerType } from '../types';
import { logger } from '../utils/logger';
import { getChatSystemInstruction } from './promptService';
import {
  initializeLocalModel as tauriInitLocalModel,
  generateLocalText as tauriGenerateLocalText,
  isLocalModelLoaded as tauriIsLocalModelLoaded,
  getLocalModelInfo as tauriGetLocalModelInfo,
  unloadLocalModel as tauriUnloadLocalModel,
  listLlamaModels,
} from './tauriBridge';

// --- Helpers ---

/**
 * Normalize AI config with provider-specific defaults
 */
export const normalizeAiConfig = (aiConfig: AiConfig): AiConfig => {
  const normalized = { ...aiConfig };
  if (aiConfig.provider === 'ollama' && !aiConfig.baseUrl) {
    normalized.baseUrl = 'http://localhost:11434/v1';
  }
  if (aiConfig.provider === 'gemini' && !aiConfig.baseUrl) {
    // Gemini's OpenAI-compatible layer; the Settings UI hides the Base URL
    // field for Gemini, so the default must live here for calls to work.
    normalized.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
  }
  return normalized;
};

/**
 * Detect task complexity for model selection
 */
export const detectTaskComplexity = (message: string): 'simple' | 'complex' => {
  const complexKeywords = [
    'script',
    'compare',
    'difference',
    'code',
    'json',
    'analysis',
    'explain',
    'why',
    'review',
    'create',
  ];
  if (message.length > 80 || complexKeywords.some((k) => message.toLowerCase().includes(k))) return 'complex';
  return 'simple';
};

/**
 * Get manager context for prompts
 */
export const getManagerContext = (pm: PackageManagerType) => {
  switch (pm) {
    case 'winget':
      return { name: 'Windows Package Manager', cmd: 'winget' };
    case 'chocolatey':
      return { name: 'Chocolatey', cmd: 'choco' };
    case 'scoop':
      return { name: 'Scoop', cmd: 'scoop' };
    case 'brew':
      return { name: 'Homebrew', cmd: 'brew' };
    case 'apt':
      return { name: 'APT', cmd: 'apt' };
    case 'github':
      return { name: 'GitHub', cmd: 'git' };
    default:
      return { name: 'Package Manager', cmd: 'pkg' };
  }
};

// --- Tauri Command Wrappers for Local LLMs (thin wrappers around tauriBridge) ---

export const initializeLocalModel = async (
  modelPath: string,
  backend: 'llama.cpp' | 'ollama' = 'llama.cpp'
): Promise<boolean> => {
  try {
    return await tauriInitLocalModel(modelPath, backend);
  } catch (error) {
    logger.error('Failed to initialize local model:', error);
    return false;
  }
};

export const isLocalModelLoaded = async (): Promise<boolean> => {
  try {
    return await tauriIsLocalModelLoaded();
  } catch (error) {
    logger.error('Failed to check local model status:', error);
    return false;
  }
};

export const generateLocalText = async (
  prompt: string,
  maxTokens: number = 128,
  temperature: number = 0.7
): Promise<string> => {
  try {
    return await tauriGenerateLocalText(prompt, maxTokens, temperature);
  } catch (error) {
    logger.error('Failed to generate local text:', error);
    throw error;
  }
};

export const unloadLocalModel = async (): Promise<boolean> => {
  try {
    return await tauriUnloadLocalModel();
  } catch (error) {
    logger.error('Failed to unload local model:', error);
    return false;
  }
};

export const getLocalModelInfo = async (): Promise<{
  loaded: boolean;
  modelPath?: string;
  backend?: string;
} | null> => {
  try {
    const result = await tauriGetLocalModelInfo();
    if (!result) return null;
    return {
      loaded: result.loaded,
      modelPath: result.model_path,
      backend: result.backend,
    };
  } catch (error) {
    logger.error('Failed to get local model info:', error);
    return null;
  }
};

export const listLocalModels = async (): Promise<Array<{ name: string; path: string; size: string }>> => {
  try {
    return await listLlamaModels();
  } catch (error) {
    logger.error('Failed to list local models:', error);
    return [];
  }
};

// --- OpenAI Compatible API ---

export const callOpenAICompatible = async (
  aiConfig: AiConfig,
  messages: Array<{ role: string; content: string }>,
  systemInstruction: string,
  signal?: AbortSignal
): Promise<string> => {
  const normalizedConfig = normalizeAiConfig(aiConfig);
  if (!normalizedConfig.baseUrl || !normalizedConfig.modelId) {
    throw new Error('Invalid AI Configuration for Custom Provider');
  }
  const finalMessages = [{ role: 'system', content: systemInstruction }, ...messages];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (normalizedConfig.apiKey) {
    headers['Authorization'] = 'Bearer ' + normalizedConfig.apiKey;
  }

  // Create an AbortController with a 60-second timeout if no signal was provided
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  const combinedSignal = signal ?? controller.signal;

  // If an external signal was provided, also listen for it
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  let response;
  try {
    response = await fetch(normalizedConfig.baseUrl + '/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: normalizedConfig.modelId, messages: finalMessages }),
      signal: combinedSignal,
    });
  } catch (networkError: unknown) {
    clearTimeout(timeoutId);
    if (
      networkError &&
      typeof networkError === 'object' &&
      'name' in networkError &&
      (networkError as { name?: string }).name === 'AbortError'
    ) {
      throw new Error('AI request timed out after 60 seconds. Please try again or use a shorter prompt.');
    }
    throw new Error('Unable to connect to AI Provider. Please check your internet connection and Base URL.');
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    // Try to parse error body for more details
    let errorDetail = response.statusText;
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        errorDetail = errorBody.error.message;
      } else if (errorBody?.message) {
        errorDetail = errorBody.message;
      }
    } catch {
      // Use statusText as fallback
    }
    throw new Error('AI Request Failed: ' + errorDetail);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

// --- Main AI Functions ---

export const generateAIResponse = async (
  settings: AppSettings,
  prompt: string,
  systemInstruction: string
): Promise<string> => {
  const { aiConfig } = settings;
  if (aiConfig.provider === 'local-llama' || aiConfig.provider === 'local-ollama') {
    try {
      const isLoaded = await isLocalModelLoaded();
      if (!isLoaded) {
        // For local model, use the full path if available, otherwise construct from modelId
        const modelPath = aiConfig.localModelPath || './models/' + aiConfig.modelId;
        const backend = aiConfig.provider === 'local-llama' ? 'llama.cpp' : 'ollama';
        logger.debug('[AI Service] Initializing local model with path:', modelPath);
        const initialized = await initializeLocalModel(modelPath, backend);
        if (!initialized) throw new Error('Failed to initialize local model');
      }
      const fullPrompt = systemInstruction + '\\n\\n' + prompt;
      const result = await generateLocalText(fullPrompt, 512, 0.7);
      return result;
    } catch (error) {
      logger.error('Local LLM error, falling back to OpenAI-compatible:', error);
      return callOpenAICompatible(aiConfig, [{ role: 'user', content: prompt }], systemInstruction);
    }
  }
  return callOpenAICompatible(aiConfig, [{ role: 'user', content: prompt }], systemInstruction);
};

export const transcribeAudio = async (
  _base64Audio: string,
  _mimeType: string,
  _settings: AppSettings
): Promise<string> => {
  logger.warn('Audio transcription not implemented for local LLMs');
  return '';
};

export const generateSpeech = async (_text: string, _settings: AppSettings): Promise<string> => {
  logger.warn('Speech generation not implemented for local LLMs');
  return '';
};

export const chatWithAI = async (
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  _modelType: ChatModelType,
  settings: AppSettings,
  signal?: AbortSignal
) => {
  const { activePackageManager, aiConfig } = settings;
  const managerInfo = getManagerContext(activePackageManager);
  const CHAT_SYSTEM_INSTRUCTION = getChatSystemInstruction(managerInfo.name, managerInfo.cmd);
  if (aiConfig.provider === 'local-llama' || aiConfig.provider === 'local-ollama') {
    try {
      const isLoaded = await isLocalModelLoaded();
      if (!isLoaded) {
        // For local model, use the full path if available, otherwise construct from modelId
        const modelPath = aiConfig.localModelPath || './models/' + aiConfig.modelId;
        const backend = aiConfig.provider === 'local-llama' ? 'llama.cpp' : 'ollama';
        logger.debug('[AI Service Chat] Initializing local model with path:', modelPath);
        const initialized = await initializeLocalModel(modelPath, backend);
        if (!initialized) throw new Error('Failed to initialize local model');
      }
      const formattedHistory = history.map((h) => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.parts[0].text,
      }));
      formattedHistory.push({ role: 'user', content: message });
      const chatPrompt =
        [{ role: 'system', content: CHAT_SYSTEM_INSTRUCTION }, ...formattedHistory]
          .map((m) => m.role + ': ' + m.content)
          .join('\\n\\n') + '\nassistant:';
      const result = await generateLocalText(chatPrompt, 1024, 0.7);
      return { text: result || 'No response text.', sources: [] };
    } catch (error) {
      logger.error('Local LLM chat error:', error);
      throw error;
    }
  }
  const messages = history.map((h) => ({
    role: h.role === 'model' ? 'assistant' : 'user',
    content: h.parts[0].text,
  }));
  messages.push({ role: 'user', content: message });
  const text = await callOpenAICompatible(aiConfig, messages, CHAT_SYSTEM_INSTRUCTION, signal);
  return { text, sources: [] };
};
