
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Trash2, Loader2, Zap, BrainCircuit, Sparkles, Box } from 'lucide-react';
import { ChatMessage, ChatModelType, WingetPackage } from '../types';
import { chatWithAI } from '../services/wingetService';
import { useChatAudio } from '../hooks/useChatAudio';
import { useAppStore } from '../stores/store';

// Helper for highlighting text safely
const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="text-[var(--app-primary)] font-bold">{part}</span>
        ) : <span key={i}>{part}</span>
      )}
    </span>
  );
};

// Component to render chat messages with Markdown support (Tables, Code, Bold)
const MessageContent = ({ text }: { text: string }) => {
  // Regex to identify markdown table blocks
  const tableRegex = /(\|.*\|(?:\r?\n|\r)\|[-:| ]+\|(?:\r?\n|\r)(?:\|.*\|(?:\r?\n|\r)?)+)/g;
  const parts = text.split(tableRegex);

  return (
    <div className="space-y-2 text-sm">
      {parts.map((part, index) => {
        // Render Table
        if (part.trim().startsWith('|') && part.includes('---')) {
            const rows = part.trim().split(/\r?\n/).map(row => 
                row.split('|').slice(1, -1).map(cell => cell.trim())
            ).filter(row => row.length > 0);
            
            // Filter out separator row
            const contentRows = rows.filter(row => !row[0].match(/^-+$/));
            
            if (contentRows.length === 0) return null;

            const header = contentRows[0];
            const body = contentRows.slice(1);

            return (
                <div key={index} className="overflow-hidden my-4 border border-[var(--app-border)] rounded-xl shadow-md bg-[var(--app-surface)]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-[var(--app-primary)]/10 border-b border-[var(--app-border)]">
                                    {header.map((h, i) => (
                                        <th key={i} className={`p-4 font-bold text-[var(--app-text)] whitespace-nowrap ${i === 0 ? 'bg-[var(--app-surface)]/50' : ''}`}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--app-border)]">
                                 {body.map((row, rI) => (
                                     <tr key={rI} className="hover:bg-[var(--app-primary)]/5 transition-colors group">
                                         {row.map((c, cI) => (
                                             <td key={cI} className={`p-3 align-top ${cI === 0 ? 'font-semibold text-[var(--app-text-muted)] bg-[var(--app-bg)]/30 border-r border-[var(--app-border)]' : 'text-[var(--app-text)]'}`}>
                                                 {c}
                                             </td>
                                         ))}
                                     </tr>
                                 ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        // Render Regular Text with formatting
        if (!part.trim()) return null;
        
        return (
             <div key={index} className="whitespace-pre-wrap leading-relaxed">
                {part.split('```').map((chunk, i) => {
                    if (i % 2 === 1) { // Code block
                        return (
                            <div key={i} className="relative group my-2">
                                <code className="block bg-[var(--app-bg)] p-3 rounded-lg border border-[var(--app-border)] font-mono text-xs overflow-x-auto text-[var(--app-primary)] shadow-inner">
                                    {chunk.trim()}
                                </code>
                            </div>
                        );
                    }
                    // Bold handling **text**
                    const boldParts = chunk.split(/\*\*(.*?)\*\*/g);
                    return (
                        <span key={i}>
                            {boldParts.map((b, bi) => bi % 2 === 1 ? <strong key={bi} className="text-[var(--app-primary)] font-bold">{b}</strong> : b)}
                        </span>
                    );
                })}
             </div>
        );
      })}
    </div>
  );
};

interface ChatInterfaceProps {
  onShowResults?: (packages: WingetPackage[]) => void;
  pendingMessage?: string;
  onClearPendingMessage?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onShowResults, pendingMessage, onClearPendingMessage }) => {
  const { settings, updateSettings } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize model type from settings
  const [modelType, setModelType] = useState<ChatModelType>(settings.defaultModel);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isRecording, startRecording, stopRecording } = useChatAudio(settings, setInput);

  useEffect(() => {
     if (pendingMessage) { setIsOpen(true); handleSend(pendingMessage); if (onClearPendingMessage) onClearPendingMessage(); }
  }, [pendingMessage]);

  useEffect(() => {
    // Scroll to new message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleModelChange = (type: ChatModelType) => {
      setModelType(type);
      updateSettings({ defaultModel: type });
  };

  const handleSend = async (textInput?: string) => {
    const text = textInput || input;
    if (!text.trim()) return;
    setInput(''); 
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    
    try {
        const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const response = await chatWithAI(text, history, modelType, settings);
        const botMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: response.text, timestamp: Date.now(), sources: response.sources };
        setMessages(prev => [...prev, botMsg]);
    } catch (e) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Error connecting to AI.", timestamp: Date.now() }]);
    } finally {
        setIsLoading(false);
    }
  };

  const getModelIcon = () => {
      switch(modelType) {
          case 'fast': return <Zap size={14} className="text-yellow-400" />;
          case 'smart': return <Sparkles size={14} className="text-purple-400" />;
          case 'thinking': return <BrainCircuit size={14} className="text-blue-400" />;
          default: return <Box size={14} className="text-green-400" />;
      }
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 z-40 p-4 bg-[var(--app-primary)] text-white rounded-full shadow-lg hover:scale-110 transition-transform">
        {isOpen ? <X /> : <MessageSquare />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[450px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
           {/* Header */}
           <div className="p-3 border-b border-[var(--app-border)] bg-[var(--app-bg)] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                 <div className="p-1.5 bg-[var(--app-primary)]/20 rounded-lg text-[var(--app-primary)]"><Bot size={18}/></div>
                 <div>
                     <h3 className="font-bold text-sm leading-none">AI Assistant</h3>
                     <p className="text-[10px] text-[var(--app-text-muted)]">Powered by {settings.aiConfig.provider}</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 {/* Model Selector */}
                 <div className="relative group">
                     <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded text-xs cursor-pointer hover:border-[var(--app-primary)] transition-colors">
                        {getModelIcon()}
                        <span className="capitalize font-medium">{modelType}</span>
                     </div>
                     <select 
                        value={modelType}
                        onChange={(e) => handleModelChange(e.target.value as ChatModelType)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                     >
                        <option value="fast">Fast (Flash Lite)</option>
                        <option value="balanced">Balanced (Flash)</option>
                        <option value="smart">Smart (Pro)</option>
                        <option value="thinking">Thinking (Reasoning)</option>
                     </select>
                 </div>
                 <button onClick={() => setMessages([])} className="p-1.5 hover:bg-red-500/10 rounded-lg text-[var(--app-text-muted)] hover:text-red-500 transition-colors" title="Clear Chat"><Trash2 size={16} /></button>
              </div>
           </div>

           {/* Messages Area */}
           <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--app-bg)]/50 scroll-smooth">
              {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-[var(--app-text-muted)] opacity-60">
                      <Bot size={48} className="mb-2" />
                      <p className="text-sm">How can I help you manage your software today?</p>
                  </div>
              )}
              {messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] p-3 rounded-2xl text-sm shadow-sm ${m.role === 'user' ? 'bg-[var(--app-primary)] text-white rounded-tr-none' : 'bg-[var(--app-surface)] border border-[var(--app-border)] rounded-tl-none'}`}>
                          {m.role === 'user' ? m.text : <MessageContent text={m.text} />}
                          
                          {m.sources && m.sources.length > 0 && (
                             <div className="mt-3 pt-2 border-t border-[var(--app-border)]/50 text-xs">
                                <p className="font-bold opacity-70 mb-1">Sources:</p>
                                <ul className="list-disc pl-4 space-y-0.5">
                                    {m.sources.map((s, i) => (
                                        <li key={i}><a href={s.uri} target="_blank" rel="noreferrer" className="underline hover:text-[var(--app-primary)] truncate block max-w-[200px]">{s.title}</a></li>
                                    ))}
                                </ul>
                             </div>
                          )}
                      </div>
                  </div>
              ))}
              {isLoading && (
                  <div className="flex justify-start">
                      <div className="bg-[var(--app-surface)] border border-[var(--app-border)] px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                         <Loader2 className="animate-spin" size={14}/> 
                         {modelType === 'thinking' ? 'Reasoning...' : 'Thinking...'}
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
           </div>

           {/* Input Area */}
           <div className="p-3 border-t border-[var(--app-border)] bg-[var(--app-surface)] shrink-0">
              <div className="flex gap-2">
                 <input 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask to compare apps, write scripts..." 
                    className="flex-1 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent outline-none transition-all shadow-inner" 
                 />
                 <button onClick={() => handleSend()} disabled={!input.trim() && !isLoading} className="p-2.5 bg-[var(--app-primary)] hover:opacity-90 disabled:opacity-50 text-white rounded-xl shadow-lg transition-all"><Send size={18}/></button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};
