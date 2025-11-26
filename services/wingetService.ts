import { GoogleGenAI, Type } from "@google/genai";
import { WingetPackage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a backend for a Windows Package Manager (winget) web interface. 
Your goal is to return valid, real, and popular Winget package data based on user queries.
Always return a strictly valid JSON array.
Do not invent packages. Use real Package IDs (e.g., 'Mozilla.Firefox', 'Microsoft.VSCode').
Classify them into general categories like 'Development', 'Utilities', 'Browsers', 'Media', 'Gaming', 'System'.
`;

export const searchPackages = async (query: string): Promise<WingetPackage[]> => {
  try {
    const model = "gemini-2.5-flash";
    const isPopularRequest = query === "POPULAR_ESSENTIALS";
    
    const prompt = isPopularRequest 
      ? "List 12 essential and popular Windows apps for developers and power users (e.g. VS Code, Terminal, Chrome, 7zip, etc)."
      : `Search for winget packages related to: "${query}". Return at least 6 relevant packages if possible.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "The precise winget package ID (e.g. 'Microsoft.VisualStudioCode')" },
              name: { type: Type.STRING, description: "The common product name" },
              description: { type: Type.STRING, description: "A short description of the app (max 100 chars)" },
              publisher: { type: Type.STRING, description: "The publisher name" },
              category: { type: Type.STRING, description: "A general category for the app" },
              version: { type: Type.STRING, description: "The latest stable version (approximate)" },
            },
            required: ["id", "name", "description", "publisher", "category"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text) as WingetPackage[];
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};