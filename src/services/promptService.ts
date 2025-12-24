import { WingetPackage } from '../types';

// Prompt generators for AI interactions

export const generateAppDetailsPrompt = (name: string, id: string) =>
    `Briefly explain what ${name} (${id}) is and its main features.`;

export const generateAlternativesPrompt = (name: string) =>
    `List 5 best alternatives to ${name}.`;

export const generateEvaluationPrompt = (name: string) =>
    `Evaluate ${name} based on performance, security, and user ratings.`;

export const generateComparisonPrompt = (packages: WingetPackage[]) =>
    `Compare these packages: ${packages.map(p => p.name).join(', ')}. Return a JSON object with keys: apps (array of names), features (array of objects {name, values[]}), pros (array of objects {app, items[]}), cons (array of objects {app, items[]}), verdict (string).`;

// System instruction generator for chat
export const getChatSystemInstruction = (managerName: string, managerCmd: string) => `
You are an expert, helpful assistant for the ${managerName}.
Your goal is to assist users in finding, installing, upgrading, and removing software on using ${managerCmd}.

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
   
3. **Commands:** When suggesting commands, use code blocks (e.g., \`${managerCmd} <id>\`).
4. **Package Lists:** ONLY if asked to find/search/recommend apps to install, include a structured JSON array at the very end of your response in a \`\`\`json\`\`\` block.
   - The JSON **MUST** be an array of objects with these exact fields:
     - \`id\`: The package ID (e.g., "Microsoft.VisualStudioCode")
     - \`name\`: The full name (e.g., "Visual Studio Code")
     - \`description\`: A short description
     - \`source\`: "${managerCmd}"
   
   Example JSON:
   \`\`\`json
   [
     { "id": "Mozilla.Firefox", "name": "Mozilla Firefox", "description": "Fast, private browser.", "source": "winget" }
   ]
   \`\`\`

5. **Context:** You are currently configured for **${managerName}**. Do not provide commands for other package managers unless asked.
`;
