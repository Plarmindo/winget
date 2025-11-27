import { GoogleGenAI, Modality } from "@google/genai";
import { WingetPackage, ChatModelType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Simple in-memory cache for search results to improve latency (addressing critique)
const searchCache = new Map<string, WingetPackage[]>();

const SYSTEM_INSTRUCTION = `
You are a backend for a Windows Package Manager (winget) web interface. 
Your goal is to return valid, real, and popular Winget package data based on user queries.
Always return a strictly valid JSON array.

CRITICAL RULES:
1. Do NOT invent Package IDs. If you are unsure, do not list it.
2. Use REAL Package IDs (e.g., 'Mozilla.Firefox', 'Microsoft.VSCode', 'Valve.Steam').
3. HALLUCINATIONS OF IDs ARE FORBIDDEN.
4. Classify them into categories like 'Development', 'Utilities', 'Browsers', 'Media', 'Gaming', 'System'.
`;

export const generateAppDetailsPrompt = (appName: string, pkgId: string): string => {
  return `Tell me more about the software "${appName}" (ID: ${pkgId}). What does it do, key features, and is it recommended?`;
};

export const generateAlternativesPrompt = (appName: string): string => {
  return `alternatives to ${appName}`;
};

export const generateEvaluationPrompt = (appName: string): string => {
  return `Evaluate the software "${appName}" honestly. No sugar coating.
  Provide:
  1. What is it?
  2. The Pros.
  3. The Cons.
  4. A final Verdict (Recommended/Not Recommended).`;
};

export const searchPackages = async (query: string, excludeIds: string[] = [], signal?: AbortSignal): Promise<WingetPackage[]> => {
  // Check Cache first to reduce latency
  const cacheKey = `${query}-${excludeIds.sort().join(',')}`;
  if (searchCache.has(cacheKey)) {
    console.log("Serving from cache:", cacheKey);
    return searchCache.get(cacheKey)!;
  }

  try {
    const model = "gemini-2.5-flash"; // Use Flash for speed
    const isPopularRequest = query === "POPULAR_ESSENTIALS";
    
    let prompt = "";
    const excludeStr = excludeIds.length > 0 ? `Do NOT include these Package IDs: ${excludeIds.join(', ')}.` : "";

    if (isPopularRequest) {
      prompt = `List 24 essential and popular Windows apps for developers and power users (e.g. VS Code, Terminal, Chrome, 7zip, Docker, Discord, Spotify, PowerToys). 
      ${excludeStr} 
      Return ONLY a JSON array of objects with keys: id, name, description, publisher, category, version.
      Ensure the JSON is valid and strictly formatted.`;
    } else {
      // Enhanced prompt for typo resilience and fuzzy matching
      prompt = `The user is searching for software using the term "${query}".
      1. First, correct any potential typos in the search term.
      2. Identify the specific software or type of software the user wants.
      3. Use Google Search to verify the correct Winget Package IDs.
      4. Return around 24 relevant packages.
      ${excludeStr}
      
      Return ONLY a raw JSON array of objects with keys: id, name, description, publisher, category, version.
      Do not wrap in markdown code blocks if possible.`;
    }

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }], // Grounding enabled for accuracy
      },
    });

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const text = response.text;
    if (!text) return [];
    
    // Cleanup markdown if present
    let jsonString = text;
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      jsonString = markdownMatch[1];
    } else {
       const simpleMatch = text.match(/```\s*([\s\S]*?)\s*```/);
       if (simpleMatch) jsonString = simpleMatch[1];
    }

    // Cleanup potential leading/trailing non-json text
    const firstBracket = jsonString.indexOf('[');
    const lastBracket = jsonString.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      jsonString = jsonString.substring(firstBracket, lastBracket + 1);
    }

    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) return [];
      
      const results = parsed.filter((pkg: any) => 
        pkg && 
        typeof pkg.id === 'string' && 
        typeof pkg.name === 'string'
      ) as WingetPackage[];

      // Cache the valid results
      if (results.length > 0) {
        searchCache.set(cacheKey, results);
      }

      return results;
    } catch (e) {
      console.warn("Failed to parse JSON from search result", e);
      return [];
    }
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message === 'Aborted') {
      console.log('Search aborted');
      throw error;
    }
    console.error("Gemini Search Error:", error);
    return [];
  }
};

/**
 * Parses the raw text output from 'winget list' or 'winget upgrade' into WingetPackage objects.
 */
export const parseWingetOutput = (output: string): WingetPackage[] => {
  const lines = output.split('\n');
  const packages: WingetPackage[] = [];
  
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('---')) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === 0 && lines.length > 2) startIndex = 2;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(/\s{2,}/);
    
    if (columns.length >= 2) {
      const name = columns[0];
      const id = columns[1];
      const version = columns[2] || 'Unknown';
      
      let availableVersion = undefined;
      let category = 'Installed';

      if (columns.length >= 4) {
         const col3 = columns[3].trim();
         if (!['winget', 'msstore', 'xwinget'].includes(col3.toLowerCase()) && /^[0-9.]+/.test(col3)) {
            availableVersion = col3;
            category = 'Update Available';
         }
      }

      if (id && id.length > 2 && !id.includes(' ')) {
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64
            }
          },
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
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      }
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("TTS error:", error);
    return null;
  }
};

const CHAT_SYSTEM_INSTRUCTION = `
You are an expert, helpful assistant for the Windows Package Manager (Winget).
Your goal is to assist users in finding, installing, upgrading, and removing software on Windows.

**Response Guidelines:**
1.  **Formatting:** Use standard Markdown. Use bold for package names and code blocks for commands.
2.  **Commands:** When suggesting commands, use code blocks (e.g., \`winget install <id> -e\`). Always prefer the \`-e\` (exact) flag.
3.  **Package Lists:** If the user asks to find, list, or recommends apps, YOU MUST include a structured JSON array at the end of your response in a separate \`\`\`json\`\`\` block.
    *   The JSON must be an array of objects with keys: \`id\`, \`name\`, \`description\`, \`publisher\` (optional), \`category\` (optional).
4.  **Tone:** Be technical but accessible. Concise and accurate.
`;

export const chatWithAI = async (
  message: string, 
  history: { role: string, parts: { text: string }[] }[],
  modelType: ChatModelType,
  signal?: AbortSignal
) => {
  let modelName = 'gemini-2.5-flash';
  let config: any = {
    systemInstruction: CHAT_SYSTEM_INSTRUCTION,
    tools: [{ googleSearch: {} }],
  };

  if (modelType === 'fast') {
    modelName = 'gemini-2.5-flash-lite';
    config.tools = undefined; 
  } else if (modelType === 'smart') {
    modelName = 'gemini-3-pro-preview';
  } else if (modelType === 'thinking') {
    modelName = 'gemini-3-pro-preview';
    config.thinkingConfig = { thinkingBudget: 32768 };
  } else {
      modelName = 'gemini-2.5-flash'; 
  }

  try {
    const chat = ai.chats.create({
      model: modelName,
      history: history,
      config: config
    });

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // Note: The new SDK uses sendMessage, which returns a promise.
    // We can't strictly cancel the HTTP request easily if the SDK doesn't expose it,
    // but we can check the signal right before returning to avoid UI updates.
    // Ideally we pass signal to the underlying fetch if possible, but here we perform a logic check.
    const result = await chat.sendMessage({ message });
    
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const sources = result.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => ({
        uri: chunk.web?.uri,
        title: chunk.web?.title || 'Source Link'
      }))
      .filter((s: any) => s.uri) || [];

    return {
      text: result.text,
      sources: sources
    };
  } catch (error) {
    if (signal?.aborted || (error as any).name === 'AbortError') {
      throw new DOMException('Aborted', 'AbortError');
    }
    console.error("Chat error:", error);
    throw error;
  }
};

export const enhancePrompt = async (originalPrompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Rewrite the following user query to be more specific and effective for finding Windows software packages via Winget. 
      If it's vague, add context (e.g. "browsers" -> "popular modern web browsers for windows").
      Keep it concise. Return ONLY the rewriten prompt text.
      Original: "${originalPrompt}"`
    });
    return response.text?.trim() || originalPrompt;
  } catch (error) {
    return originalPrompt;
  }
};