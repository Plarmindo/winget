import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Mic, Send, X, Bot, BrainCircuit, Zap, Volume2, Sparkles, Loader2, StopCircle, Trash2, Grid, Box, Copy, Check, Link as LinkIcon, ArrowRight, Clock, Package, TrendingUp, Wand2, Scale } from 'lucide-react';
import { ChatMessage, ChatModelType, WingetPackage } from '../types';
import { chatWithAI, enhancePrompt } from '../services/wingetService';
import { useChatAudio } from '../hooks/useChatAudio';
import { POPULAR_SUGGESTIONS, STORAGE_KEYS } from '../constants';
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

interface ChatInterfaceProps {
  onShowResults?: (packages: WingetPackage[]) => void;
  pendingMessage?: string;
  onClearPendingMessage?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onShowResults, pendingMessage, onClearPendingMessage }) => {
  const { settings } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedProposals, setEnhancedProposals] = useState<{ label: string; text: string }[]>([]);
  const [modelType, setModelType] = useState<ChatModelType>(settings.defaultModel);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isRecording, startRecording, stopRecording, playTTS } = useChatAudio(settings, setInput);

  useEffect(() => {
     if (pendingMessage) { setIsOpen(true); handleSend(pendingMessage); if (onClearPendingMessage) onClearPendingMessage(); }
  }, [pendingMessage]);

  const handleSend = async (textInput?: string) => {
    const text = textInput || input;
    if (!text.trim()) return;
    setInput(''); setShowSuggestions(false);
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

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 z-40 p-4 bg-[var(--app-primary)] text-white rounded-full shadow-lg hover:scale-110 transition-transform">
        {isOpen ? <X /> : <MessageSquare />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] max-h-[calc(100vh-8rem)] bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40">
           <div className="p-4 border-b border-[var(--app-border)] flex justify-between items-center bg-[var(--app-bg)]">
              <span className="font-bold flex items-center gap-2"><Bot size={18}/> AI Assistant</span>
              <button onClick={() => setMessages([])}><Trash2 size={16} className="text-[var(--app-text-muted)] hover:text-red-500"/></button>
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--app-bg)]/50">
              {messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-xl text-sm ${m.role === 'user' ? 'bg-[var(--app-primary)] text-white' : 'bg-[var(--app-surface)] border border-[var(--app-border)]'}`}>
                          {m.text}
                      </div>
                  </div>
              ))}
              {isLoading && <div className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]"><Loader2 className="animate-spin" size={12}/> Thinking...</div>}
              <div ref={messagesEndRef} />
           </div>
           <div className="p-3 border-t border-[var(--app-border)] bg-[var(--app-surface)]">
              <div className="flex gap-2">
                 <input 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Ask about packages..." 
                    className="flex-1 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--app-primary)] outline-none" 
                 />
                 <button onClick={() => handleSend()} className="p-2 bg-[var(--app-primary)] text-white rounded-lg"><Send size={18}/></button>
              </div>
           </div>
        </div>
      )}
    </>
  );
};