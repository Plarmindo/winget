import { GoogleGenAI, Modality } from "@google/genai";
import { WingetPackage, ChatModelType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a backend for a Windows Package Manager (winget) web interface. 
Your goal is to return valid, real, and popular Winget package data based on user queries.
Always return a strictly valid JSON array.
Do not invent packages. Use real Package IDs (e.g., 'Mozilla.Firefox', 'Microsoft.VSCode').
Classify them into general categories like 'Development', 'Utilities', 'Browsers', 'Media', 'Gaming', 'System'.
`;

export const generateAppDetailsPrompt = (appName: string, pkgId: string): string => {
  return `Tell me more about the software "${appName}" (ID: ${pkgId}). What does it do, key features, and is it recommended?`;
};

export const searchPackages = async (query: string, excludeIds: string[] = [], signal?: AbortSignal): Promise<WingetPackage[]> => {
  try {
    const model = "gemini-2.5-flash";
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
      1. First, correct any potential typos in the search term (e.g., "vscdoe" -> "vscode", "notpad" -> "notepad").
      2. Identify the specific software or type of software the user wants.
      3. Use Google Search to verify the correct Winget Package IDs for this software.
      4. Return around 24 relevant packages to allow for pagination.
      ${excludeStr}
      
      Return ONLY a raw JSON array of objects with keys: id, name, description, publisher, category, version.
      Do not wrap in markdown code blocks if possible, or use standard json blocks.`;
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
    
    // Cleanup markdown if present (model might still wrap it despite instructions)
    let jsonString = text;
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      jsonString = markdownMatch[1];
    } else {
       const simpleMatch = text.match(/```\s*([\s\S]*?)\s*```/);
       if (simpleMatch) jsonString = simpleMatch[1];
    }

    // Attempt to clean cleanup potential leading/trailing non-json text
    const firstBracket = jsonString.indexOf('[');
    const lastBracket = jsonString.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
      jsonString = jsonString.substring(firstBracket, lastBracket + 1);
    }

    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) return [];
      
      // Validation to prevent crashes in UI
      return parsed.filter((pkg: any) => 
        pkg && 
        typeof pkg.id === 'string' && 
        typeof pkg.name === 'string'
      ) as WingetPackage[];
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
 * Handles standard table format.
 */
export const parseWingetOutput = (output: string): WingetPackage[] => {
  const lines = output.split('\n');
  const packages: WingetPackage[] = [];
  
  // Skip header lines (usually starts with Name or ----)
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('---')) {
      startIndex = i + 1;
      break;
    }
  }

  // Fallback if no separator found, try to guess based on content
  if (startIndex === 0 && lines.length > 2) startIndex = 2;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Winget list columns are dynamic, but ID is usually the second column looking item
    // Regex strategy: Name (greedy)   ID (no spaces)    Version (no spaces)   Available(opt)  Source(opt)
    // This is approximate but works for the majority of standard outputs
    
    // Splitting by 2 or more spaces is a safer bet for table columns
    const columns = line.split(/\s{2,}/);
    
    if (columns.length >= 2) {
      const name = columns[0];
      const id = columns[1];
      const version = columns[2] || 'Unknown';
      
      // Check for 'Available' column (typically 4th column in 'winget upgrade' output)
      // Standard 'winget list': Name, Id, Version, Source
      // Standard 'winget upgrade': Name, Id, Version, Available, Source
      
      let availableVersion = undefined;
      let category = 'Installed';

      // Heuristic: If there is a 4th column and it looks like a version number (digits/dots), it's likely "Available"
      if (columns.length >= 4) {
         const col3 = columns[3].trim();
         // If col3 is NOT a source (like 'winget' or 'msstore'), assume it's available version
         if (!['winget', 'msstore', 'xwinget'].includes(col3.toLowerCase()) && /^[0-9.]+/.test(col3)) {
            availableVersion = col3;
            category = 'Update Available';
         }
      }

      // Basic validation to ensure it looks like a package
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
    
    // Extract base64 audio (Raw PCM)
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
2.  **Commands:** When suggesting commands, use code blocks (e.g., \`winget install <id> -e\`). Always prefer the \`-e\` (exact) flag for safety.
3.  **Package Lists:** If the user asks to find, list, or recommends apps, YOU MUST include a structured JSON array at the end of your response in a separate \`\`\`json\`\`\` block.
    *   The JSON must be an array of objects with keys: \`id\`, \`name\`, \`description\`, \`publisher\` (optional), \`category\` (optional).
    *   Example:
        \`\`\`json
        [
          { "id": "Microsoft.VSCode", "name": "Visual Studio Code", "description": "Code editor", "category": "Development" }
        ]
        \`\`\`
4.  **Tone:** Be technical but accessible. Concise and accurate.

**Capabilities:**
*   Analyze 'winget list' output to suggest upgrades.
*   Explain complex winget arguments.
*   Generate scripts.
`;

export const chatWithAI = async (
  message: string, 
  history: { role: string, parts: { text: string }[] }[],
  modelType: ChatModelType
) => {
  let modelName = 'gemini-2.5-flash';
  let config: any = {
    systemInstruction: CHAT_SYSTEM_INSTRUCTION,
    tools: [{ googleSearch: {} }], // Enable grounding for chat as well
  };

  if (modelType === 'fast') {
    modelName = 'gemini-2.5-flash-lite';
    config.tools = undefined; // Lite might not support tools depending on exact version, but usually safer to disable if speed is key
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

    const result = await chat.sendMessage({ message });
    
    // Extract sources from grounding metadata
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
