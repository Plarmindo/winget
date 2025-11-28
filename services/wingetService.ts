import { GoogleGenAI, Modality } from "@google/genai";
import { WingetPackage, ChatModelType, AppSettings, AiConfig, PackageManagerType } from "../types";

// Helper to get package manager specific instructions
const getManagerContext = (pm: PackageManagerType) => {
  switch (pm) {
    case 'chocolatey':
      return {
        name: 'Chocolatey',
        cmd: 'choco install',
        idExample: 'git.install, googlechrome, vscode',
        validation: 'Use valid Chocolatey package IDs.'
      };
    case 'scoop':
      return {
        name: 'Scoop',
        cmd: 'scoop install',
        idExample: 'git, googlechrome, vscode',
        validation: 'Use valid Scoop bucket/app names.'
      };
    case 'brew':
      return {
        name: 'Homebrew',
        cmd: 'brew install',
        idExample: 'git, google-chrome, visual-studio-code',
        validation: 'Use valid Homebrew formulae or cask names.'
      };
    case 'apt':
      return {
        name: 'APT (Advanced Package Tool)',
        cmd: 'sudo apt install',
        idExample: 'git, chromium-browser, code',
        validation: 'Use valid Debian/Ubuntu package names.'
      };
    case 'winget':
    default:
      return {
        name: 'Windows Package Manager (winget)',
        cmd: 'winget install',
        idExample: 'Mozilla.Firefox, Microsoft.VSCode, Valve.Steam',
        validation: 'Use REAL Winget Package IDs (e.g., Publisher.App).'
      };
  }
};

// --- AI ABSTRACTION LAYER ---

const cleanBaseUrl = (url: string) => {
  if (!url) return '';
  return url.replace(/\/+$/, '');
};

const callOpenAICompatible = async (config: AiConfig, messages: any[], systemInstruction?: string, signal?: AbortSignal) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const finalMessages = systemInstruction 
    ? [{ role: 'system', content: systemInstruction }, ...messages]
    : messages;

  const body = {
    model: config.modelId || 'gpt-3.5-turbo',
    messages: finalMessages,
    temperature: 0.7
  };

  const baseUrl = cleanBaseUrl(config.baseUrl || 'https://api.openai.com/v1');

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Provider Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error: any) {
    if (signal?.aborted || error.name === 'AbortError') throw error;
    
    console.error("AI Call Failed:", error);
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error(`Connection failed to ${baseUrl}. Check your URL, CORS settings, or Mixed Content (HTTPS accessing HTTP) restrictions.`);
    }
    
    throw error;
  }
};

const callGemini = async (settings: AppSettings, prompt: string | any, systemInstruction?: string, tools?: any, signal?: AbortSignal) => {
  // Use env key if config key is missing for Gemini
  const apiKey = settings.aiConfig.apiKey || process.env.API_KEY;
  if (!apiKey) throw new Error("No API Key available for Google Gemini. Please check Settings.");

  const ai = new GoogleGenAI({ apiKey });
  
  // Map ChatModelType logic or use config model
  let modelName = settings.aiConfig.modelId || "gemini-2.5-flash";
  
  const performGenerate = async (currentTools?: any) => {
      const config: any = {
        systemInstruction,
        tools: currentTools
      };
      
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config
      });
      return response.text || "";
  };

  try {
    return await performGenerate(tools);
  } catch (error: any) {
    const errStr = error.message || JSON.stringify(error);
    // Check for Search Grounding Quota limit (429 Resource Exhausted specific to search_grounding)
    const isSearchQuotaError = errStr.includes('search_grounding_request_per_project_per_day_per_user') || 
                               (errStr.includes('RESOURCE_EXHAUSTED') && tools && JSON.stringify(tools).includes('googleSearch'));

    if (isSearchQuotaError) {
        console.warn("Gemini Search Grounding quota exceeded. Retrying without search tools.");
        try {
            // Retry without tools (disabling search for this request)
            return await performGenerate(undefined);
        } catch (retryError: any) {
             throw new Error(`Gemini API Error (Retry failed): ${retryError.message || 'Unknown error'}`);
        }
    }

    console.error("Gemini API Error:", error);

    if (errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED')) {
         throw new Error("Gemini API Quota Exceeded. Please try again later or check your billing.");
    }

    throw new Error(`Gemini API Error: ${error.message || 'Unknown error'}`);
  }
};

// Unified AI Caller
const generateAIResponse = async (
  settings: AppSettings, 
  content: string | { role: string, content: string }[], 
  systemInstruction: string,
  useTools: boolean = true,
  signal?: AbortSignal
): Promise<string> => {
  const { provider } = settings.aiConfig;

  if (provider === 'gemini') {
    // Gemini handles tools (Google Search) natively
    const tools = useTools ? [{ googleSearch: {} }] : undefined;
    
    // Map OpenAI-style messages to Gemini history if array (Simple fallback)
    if (Array.isArray(content)) {
       // Just concatenate for simple search usage if accidentally passed array
       const prompt = content.map(c => `${c.role}: ${c.content}`).join('\n');
       return await callGemini(settings, prompt, systemInstruction, tools, signal);
    }

    return await callGemini(settings, content, systemInstruction, tools, signal);
  } else {
    // OpenAI / Ollama / Custom
    let sys = systemInstruction;
    if (useTools) {
       sys += "\n\nNOTE: You do not have real-time internet access. Rely on your internal knowledge to generate valid package data.";
    }

    const messages = typeof content === 'string' ? [{ role: 'user', content }] : content;
    return await callOpenAICompatible(settings.aiConfig, messages, sys, signal);
  }
};

// --- END AI ABSTRACTION ---

// Simple in-memory cache
const searchCache = new Map<string, WingetPackage[]>();

export const generateAppDetailsPrompt = (appName: string, pkgId: string): string => {
  return `Tell me more about the software "${appName}" (ID: ${pkgId}). What does it do, key features, and is it recommended?`;
};

export const generateAlternativesPrompt = (appName: string): string => {
  return `alternatives to ${appName}`;
};

export const generateEvaluationPrompt = (appName: string): string => {
  return `Evaluate the software "${appName}" honestly. No sugar coating. Provide Pros, Cons, and a Verdict.`;
};

const processSearchResult = (text: string | undefined): WingetPackage[] => {
  if (!text) return [];
  
  let jsonString = text;
  const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (markdownMatch) {
    jsonString = markdownMatch[1];
  } else {
     const simpleMatch = text.match(/```\s*([\s\S]*?)\s*```/);
     if (simpleMatch) jsonString = simpleMatch[1];
  }

  const firstBracket = jsonString.indexOf('[');
  const lastBracket = jsonString.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1) {
    jsonString = jsonString.substring(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) return [];
    
    return parsed.filter((pkg: any) => 
      pkg && 
      (typeof pkg.id === 'string' || typeof pkg.name === 'string')
    ).map(pkg => ({
      ...pkg,
      id: pkg.id || pkg.name, // Fallback for systems like apt
      name: pkg.name || pkg.id,
      description: pkg.description || 'No description provided.',
      publisher: pkg.publisher || 'Unknown',
      category: pkg.category || 'Utility'
    })) as WingetPackage[];
  } catch (e) {
    console.warn("Failed to parse JSON from search result", e);
    return [];
  }
};

export const searchPackages = async (
  query: string, 
  excludeIds: string[] = [], 
  settings: AppSettings,
  signal?: AbortSignal
): Promise<WingetPackage[]> => {
  const { activePackageManager } = settings;
  const managerInfo = getManagerContext(activePackageManager);

  const cacheKey = `${activePackageManager}-${query}-${excludeIds.sort().join(',')}`;
  if (searchCache.has(cacheKey)) {
    console.log("Serving from cache:", cacheKey);
    return searchCache.get(cacheKey)!;
  }

  const isPopularRequest = query === "POPULAR_ESSENTIALS";
  const isAlternativesRequest = query.toLowerCase().startsWith('alternatives to');
  
  const SYSTEM_INSTRUCTION = `
You are a backend for a ${managerInfo.name} web interface. 
Your goal is to return valid, real, and popular package data based on user queries for ${managerInfo.name}.
Always return a strictly valid JSON array.

CRITICAL RULES:
1. ${managerInfo.validation}
2. Use REAL, EXISTING Package IDs compatible with \`${managerInfo.cmd}\`.
3. HALLUCINATIONS OF IDs ARE FORBIDDEN. If you are unsure of an ID, do not invent one.
4. Prioritize Exact Matches. If the user searches for a specific tool, ensure it is the first result.
5. Classify them into categories like 'Development', 'Utilities', 'Browsers', 'Media', 'Gaming', 'System'.
`;
  
  let prompt = "";
  const excludeStr = excludeIds.length > 0 ? `Do NOT include these IDs: ${excludeIds.join(', ')}.` : "";

  if (isPopularRequest) {
    prompt = `List 24 essential and popular apps for ${managerInfo.name} users (e.g. VS Code, Terminal, Chrome, 7zip, Docker, Discord, Spotify). 
    ${excludeStr} 
    Return ONLY a JSON array of objects with keys: id, name, description, publisher, category, version.
    Ensure the JSON is valid and strictly formatted.`;
  } else if (isAlternativesRequest) {
    const targetApp = query.replace(/^alternatives to\s+/i, '').trim();
    prompt = `The user wants to find software alternatives to "${targetApp}" on ${managerInfo.name}.
    1. Identify what "${targetApp}" is (e.g. text editor, browser, media player).
    2. List the best ALTERNATIVE packages available for this category.
    3. Do NOT simply list "${targetApp}" itself as the main result, focus on competitors/alternatives.
    4. Return up to 18 relevant packages.
    ${excludeStr}
    
    Return ONLY a raw JSON array of objects with keys: id, name, description, publisher, category, version.
    Example ID format: ${managerInfo.idExample}`;
  } else {
    prompt = `The user is searching for software using the term "${query}" on ${managerInfo.name}.
    1. Identify the specific software being requested. Prioritize exact matches for "${query}".
    2. If the term is broad, provide a diverse set of top-rated packages.
    3. Return up to 18 relevant packages.
    ${excludeStr}
    
    Return ONLY a raw JSON array of objects with keys: id, name, description, publisher, category, version.
    Example ID format: ${managerInfo.idExample}`;
  }

  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const responseText = await generateAIResponse(settings, prompt, SYSTEM_INSTRUCTION, true, signal);

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    
    const results = processSearchResult(responseText);
    if (results.length > 0) searchCache.set(cacheKey, results);
    return results;

  } catch (error: any) {
    if (signal?.aborted || error.name === 'AbortError' || error.message === 'Aborted') {
      throw error;
    }
    console.error("Search Error:", error);
    // Re-throw so UI can display it
    throw error;
  }
};

export const parseWingetOutput = (output: string): WingetPackage[] => {
  const lines = output.split('\n');
  const packages: WingetPackage[] = [];
  
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('---') || lines[i].toLowerCase().includes('name')) {
      startIndex = i + 1;
      if (lines[i].trim().startsWith('---')) break;
    }
  }

  if (startIndex === 0 && lines.length > 2) startIndex = 2;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(/\s{2,}/);
    
    if (columns.length >= 2) {
      const name = columns[0];
      const id = columns[1] || name; // Fallback
      const version = columns[2] || 'Unknown';
      
      let availableVersion = undefined;
      let category = 'Installed';

      if (columns.length >= 4) {
         const col3 = columns[3].trim();
         // Simple check to see if col3 looks like a version number
         if (/^[0-9.]+/.test(col3)) {
            availableVersion = col3;
            category = 'Update Available';
         }
      }

      if (name.length > 0) {
        packages.push({
          id: id,
          name: name,
          description: availableVersion 
            ? `Update available: ${version} -> ${availableVersion}` 
            : `Installed Version: ${version}`,
          publisher: 'Detected',
          category: category,
          version: version,
          availableVersion: availableVersion
        });
      }
    }
  }
  return packages;
};

export const transcribeAudio = async (audioBase64: string, mimeType: string = "audio/wav"): Promise<string> => {
  // Hardcoded to Gemini for Multimodal capabilities
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: "Transcribe this audio exactly. Do not add timestamps or speaker labels. Just the text." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription error:", error);
    return "";
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
   // Hardcoded to Gemini for Multimodal capabilities
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS error:", error);
    return null;
  }
};

export const chatWithAI = async (
  message: string, 
  history: { role: string, parts: { text: string }[] }[],
  modelType: ChatModelType, // Legacy param, ignored if custom provider active
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
2. **Commands:** When suggesting commands, use code blocks (e.g., \`${managerInfo.cmd} <id>\`).
3. **Package Lists:** If asked to find apps, include a structured JSON array at the end in a \`\`\`json\`\`\` block.
4. **Context:** You are currently configured for **${managerInfo.name}**. Do not provide commands for other package managers unless asked.
`;

  // If Provider is Gemini
  if (aiConfig.provider === 'gemini') {
      const apiKey = aiConfig.apiKey || process.env.API_KEY;
      if (!apiKey) throw new Error("No API Key. Check Settings.");
      
      const ai = new GoogleGenAI({ apiKey });
      
      // Determine model from config OR legacy logic
      let modelName = aiConfig.modelId || 'gemini-2.5-flash';
      // Preserve the "Thinking" mode logic if using Gemini
      let thinkingConfig = undefined;

      // If user selected specific modes in the legacy UI but didn't override model ID manually in settings:
      if (!aiConfig.modelId) {
          if (modelType === 'fast') modelName = 'gemini-2.5-flash-lite';
          else if (modelType === 'smart') modelName = 'gemini-3-pro-preview';
          else if (modelType === 'thinking') {
             modelName = 'gemini-3-pro-preview';
             thinkingConfig = { thinkingBudget: 32768 };
          }
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
          // Attempt with Search enabled first
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
                   // Retry without Search
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

export const enhancePrompt = async (originalPrompt: string, settings: AppSettings): Promise<string> => {
  try {
    const prompt = `Rewrite the following user query to be more specific and effective for finding software packages. 
      Keep it concise. Return ONLY the rewriten prompt text.
      Original: "${originalPrompt}"`;
      
    return await generateAIResponse(settings, prompt, "You are a prompt engineer.", false);
  } catch (error) {
    return originalPrompt;
  }
};