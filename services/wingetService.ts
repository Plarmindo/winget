

import { GoogleGenAI, Modality } from "@google/genai";
import { WingetPackage, ChatModelType, AppSettings, AiConfig, PackageManagerType, AppMode } from "../types";
import { isTauri, executeCliSearch, executeCliOperation } from "./tauriBridge";
import { searchGitHubRepos } from "./githubService";

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
    case 'github':
      return {
        name: 'GitHub',
        cmd: 'git clone',
        idExample: 'facebook/react, microsoft/vscode',
        validation: 'Use valid owner/repo format.'
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

const detectTaskComplexity = (text: string): 'simple' | 'complex' => {
  if (text.length > 400) return 'complex';
  // Keywords implying analysis, comparison, or creativity
  const complexPattern = /compare|difference|versus|vs\.|analyze|evaluate|pros and cons|verdict|script|generate|explain|why|how to/i;
  if (complexPattern.test(text)) return 'complex';
  return 'simple';
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
  
  // Logic to automatically select model based on complexity
  let modelName = settings.aiConfig.modelId || "gemini-2.5-flash";
  
  // Basic models that are candidates for auto-upgrade
  const BASE_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-exp'];
  
  // Analyze complexity from prompt (if string) or content parts
  let promptText = "";
  if (typeof prompt === 'string') promptText = prompt;
  else if (Array.isArray(prompt)) promptText = prompt.map((p: any) => p.text || '').join(' ');
  else if (prompt.parts) promptText = prompt.parts.map((p: any) => p.text || '').join(' ');

  const complexity = detectTaskComplexity(promptText);

  // Auto-upgrade logic: If task is complex and user is on a base model, switch to Pro
  if (complexity === 'complex' && BASE_MODELS.some(m => modelName.includes(m))) {
      console.log(`[Auto-Model] Task detected as COMPLEX. Upgrading ${modelName} to gemini-3-pro-preview`);
      modelName = 'gemini-3-pro-preview';
  }
  
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
export const generateAIResponse = async (
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

export const generateComparisonPrompt = (packages: WingetPackage[]): string => {
  const list = packages.map(p => `${p.name} (ID: ${p.id})`).join(', ');
  return `Compare the following software packages detailedly: ${list}. 
  
  OUTPUT FORMAT:
  You must return a strictly valid JSON object. Do not include markdown code blocks (like \`\`\`json). Just the raw JSON object.
  
  Structure:
  {
    "apps": ["App Name 1", "App Name 2"],
    "features": [
       { "name": "License", "values": ["Open Source", "Proprietary"] },
       { "name": "OS Support", "values": ["Win/Mac/Lin", "Windows Only"] },
       ... (add 4-6 key features)
    ],
    "pros": [
      { "app": "App Name 1", "items": ["Fast", "Free"] },
      { "app": "App Name 2", "items": ["Feature Rich", "Cloud Sync"] }
    ],
    "cons": [
       { "app": "App Name 1", "items": ["Old UI"] },
       { "app": "App Name 2", "items": ["Expensive"] }
    ],
    "verdict": "A short summary paragraph of which one to pick when."
  }`;
};

// New: Execute Real Command via Tauri
export const executeRealCommand = async (
  packageManager: PackageManagerType, 
  mode: AppMode, 
  packageIds: string[]
) => {
  if (!isTauri()) {
    console.warn("Not running in Desktop mode. Command cannot be executed natively.");
    return;
  }
  
  if (packageManager === 'github' && mode !== 'install') {
      alert("GitHub mode only supports 'clone' (install). Upgrade/Uninstall requires manual file operations.");
      return;
  }

  try {
    await executeCliOperation(packageManager, mode, packageIds);
  } catch (e) {
    console.error("Failed to spawn terminal:", e);
    alert("Failed to launch terminal command. See console.");
  }
};

export const parseWingetOutput = (output: string): WingetPackage[] => {
  const lines = output.split('\n');
  const packages: WingetPackage[] = [];
  
  let startIndex = 0;
  // Basic heuristic to find the start of the table
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('---') || line.toLowerCase().includes('name') && line.toLowerCase().includes('id')) {
      startIndex = i + 1;
      if (line.startsWith('---')) break;
    }
  }

  if (startIndex === 0 && lines.length > 2) startIndex = 2;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('-')) continue; // Skip separator lines

    // This regex is a rough approximation for standard CLI table output
    // It splits by 2 or more spaces, which is common in cli tables
    const columns = line.split(/\s{2,}/);
    
    if (columns.length >= 2) {
      const name = columns[0];
      const id = columns[1] || name; 
      const version = columns[2] || 'Unknown';
      
      let availableVersion = undefined;
      let category = 'Installed'; // Default categorization for list output

      // Check if this is an upgrade list or just a search result
      if (columns.length >= 4) {
         const col3 = columns[3].trim();
         // Heuristic: If col3 looks like a version, it might be the "Available" column
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
          availableVersion: availableVersion,
          isFree: undefined // CLI list doesn't usually provide license easily
        });
      }
    }
  }
  return packages;
};

// New: Perform Search via Tauri (Real CLI)
const searchPackagesViaTauri = async (
  query: string, 
  settings: AppSettings
): Promise<WingetPackage[]> => {
  const { activePackageManager } = settings;

  try {
    const output = await executeCliSearch(activePackageManager, query);
    return parseWingetOutput(output);
  } catch (e: any) {
    console.error("Tauri Search Error:", e);
    const errStr = e.message || e.toString();
    
    if (errStr.includes("Security Error") || errStr.includes("not in the allowlist")) {
        throw new Error(`Security Error: '${activePackageManager}' is not a permitted package manager.`);
    }
    
    if (errStr.includes("System Error") || errStr.includes("not recognized") || errStr.includes("No such file")) {
        throw new Error(`CLI Not Found: Is '${activePackageManager}' installed and in your PATH?`);
    }

    if (errStr.includes("Exit Code")) {
         // This is a command failure (e.g., search found nothing, or network error in CLI)
         throw new Error(`CLI Execution Failed: ${errStr}`);
    }

    throw new Error(`CLI Error: ${errStr}`);
  }
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
      pkg.id && // Must have ID
      pkg.name && // Must have Name
      typeof pkg.id === 'string' &&
      typeof pkg.name === 'string' &&
      pkg.id.length > 2 && // Too short is likely junk
      !pkg.id.includes(' ') && // IDs shouldn't have spaces usually (Strict for winget)
      pkg.id.toLowerCase() !== 'unknown' &&
      pkg.publisher !== 'Unknown' &&
      pkg.id !== pkg.name // Hallucination often copies name to ID exactly
    ).map(pkg => ({
      ...pkg,
      id: pkg.id, 
      name: pkg.name,
      description: pkg.description || 'No description provided.',
      publisher: pkg.publisher || 'Unknown',
      category: pkg.category || 'Utility',
      // Map JSON snake_case (requested in prompt) to camelCase type
      isFree: typeof pkg.is_free === 'boolean' ? pkg.is_free : (pkg.isFree || undefined)
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
  
  // 0. Handle GitHub Search Explicitly
  if (settings.activePackageManager === 'github') {
    return await searchGitHubRepos(query, settings.githubToken);
  }

  // 1. If running in Tauri, use real CLI
  if (isTauri() && query !== "POPULAR_ESSENTIALS") {
    // If it's a special prompt (alternatives), we might still want AI for logic,
    // but typically a CLI search just searches text.
    // For now, let's route basic searches to CLI.
    if (!query.startsWith('alternatives to')) {
       return await searchPackagesViaTauri(query, settings);
    }
  }

  // 2. Fallback to AI (Web Mode OR Complex/Popular Query)
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
3. HALLUCINATIONS OF IDs ARE FORBIDDEN. If you are unsure of an ID, DO NOT include the item.
4. Do not output items with 'Unknown' publisher or generic IDs like 'App.ID'.
5. If you cannot find verified packages, return an empty list.
6. Prioritize Exact Matches. If the user searches for a specific tool, ensure it is the first result.
7. Classify them into categories like 'Development', 'Utilities', 'Browsers', 'Media', 'Gaming', 'System'.
`;
  
  let prompt = "";
  const excludeStr = excludeIds.length > 0 ? `Do NOT include these IDs: ${excludeIds.join(', ')}.` : "";
  const jsonStructure = `Return ONLY a JSON array of objects with keys: id, name, description, publisher, category, version, is_free (boolean: true if Free/Open Source, false if Paid/Freemium/Subscription/Trial).`;

  if (isPopularRequest) {
    prompt = `List 24 essential and popular apps for ${managerInfo.name} users (e.g. VS Code, Terminal, Chrome, 7zip, Docker, Discord, Spotify). 
    ${excludeStr} 
    ${jsonStructure}
    Ensure the JSON is valid and strictly formatted.`;
  } else if (isAlternativesRequest) {
    const targetApp = query.replace(/^alternatives to\s+/i, '').trim();
    prompt = `The user wants to find software alternatives to "${targetApp}" on ${managerInfo.name}.
    1. Identify what "${targetApp}" is (e.g. text editor, browser, media player).
    2. List the best ALTERNATIVE packages available for this category.
    3. Do NOT simply list "${targetApp}" itself as the main result, focus on competitors/alternatives.
    4. Return up to 18 relevant packages.
    ${excludeStr}
    
    ${jsonStructure}
    Example ID format: ${managerInfo.idExample}`;
  } else {
    prompt = `The user is searching for software using the term "${query}" on ${managerInfo.name}.
    1. Identify the specific software being requested. Prioritize exact matches for "${query}".
    2. If the term is broad, provide a diverse set of top-rated packages.
    3. Return up to 18 relevant packages.
    ${excludeStr}
    
    ${jsonStructure}
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
  modelType: ChatModelType, // 'fast' | 'balanced' | 'smart' | 'thinking'
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
      
      let modelName = aiConfig.modelId || 'gemini-2.5-flash';
      let thinkingConfig = undefined;

      // Allow ChatInterface Model Selection to override default settings
      // We prioritize the specific user selection in the Chat UI over the generic setting
      // UNLESS the user has set a custom model ID that isn't one of the defaults.
      
      const isDefaultModelConfig = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-pro-preview', 'gemini-2.0-flash-exp'].some(m => aiConfig.modelId?.includes(m));
      
      if (isDefaultModelConfig || !aiConfig.modelId) {
          if (modelType === 'fast') modelName = 'gemini-2.5-flash-lite';
          else if (modelType === 'balanced') modelName = 'gemini-2.5-flash';
          else if (modelType === 'smart') modelName = 'gemini-3-pro-preview';
          else if (modelType === 'thinking') {
             modelName = 'gemini-3-pro-preview';
             thinkingConfig = { thinkingBudget: 32768 };
          }
      }

      // Auto-upgrade for complexity is mostly handled by modelType selection now, 
      // but we keep a safety check if they are in 'balanced' mode but ask something huge.
      const complexity = detectTaskComplexity(message);
      if (complexity === 'complex' && modelType === 'balanced' && ['gemini-2.5-flash'].includes(modelName)) {
           console.log("Auto-upgrading Chat model to Pro for complex task");
           modelName = 'gemini-3-pro-preview';
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
    const prompt = `You are a prompt engineering expert for software search queries.
      User Query: "${originalPrompt}"
      
      Create 3 distinct variations of this prompt to get better results from an AI package assistant:
      1. Concise: Short and direct.
      2. Detailed: Adds context about specific needs (e.g. for development, for gaming).
      3. Technical: Uses specific terminology (versions, dependencies).
      
      Return ONLY a JSON array of objects with keys: 'label' (string) and 'text' (string).
      Do not include markdown code blocks. Just raw JSON.`;
      
    return await generateAIResponse(settings, prompt, "You are a JSON-only prompt engineer.", false);
  } catch (error) {
    return originalPrompt;
  }
};