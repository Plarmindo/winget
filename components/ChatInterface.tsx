import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Mic, Send, X, Bot, BrainCircuit, Zap, Volume2, Sparkles, Loader2, StopCircle, Trash2, Link as LinkIcon, Box, Copy, Check, ArrowRightCircle, Grid, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ChatMessage, ChatModelType, WingetPackage } from '../types';
import { chatWithAI, transcribeAudio, generateSpeech, enhancePrompt } from '../services/wingetService';

const STORAGE_KEY = 'winget_chat_history';

const SUGGESTIONS = [
  "Find developer tools",
  "How to upgrade apps",
  "Top 10 gaming apps",
  "Install VS Code"
];

interface ChatInterfaceProps {
  onShowResults?: (packages: WingetPackage[]) => void;
  pendingMessage?: string;
  onClearPendingMessage?: () => void;
  defaultModel: ChatModelType;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onShowResults, pendingMessage, onClearPendingMessage, defaultModel }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Initialize from localStorage if available
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse chat history", e);
        }
      }
    }
    return [{
      id: '1',
      role: 'model',
      text: 'Hi! I can help you find packages, explain commands, or write complex scripts. How can I help?',
      timestamp: Date.now()
    }];
  });

  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedProposal, setEnhancedProposal] = useState<string | null>(null);
  
  const [modelType, setModelType] = useState<ChatModelType>(defaultModel);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // History Navigation State
  const [historyIndex, setHistoryIndex] = useState(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingMimeTypeRef = useRef<string>('');

  // Sync local model type when global settings change
  useEffect(() => {
    setModelType(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Save to localStorage whenever messages change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // Handle pending message from parent
  useEffect(() => {
    if (pendingMessage && pendingMessage.trim() !== '') {
      setIsOpen(true);
      handleSend(pendingMessage);
      if (onClearPendingMessage) {
        onClearPendingMessage();
      }
    }
  }, [pendingMessage]);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      const initialMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: 'History cleared. How can I help you with Winget today?',
        timestamp: Date.now()
      };
      setMessages([initialMsg]);
      localStorage.removeItem(STORAGE_KEY);
      setHistoryIndex(-1);
    }
  };

  const handleEnhance = async () => {
    if (!input.trim() || isEnhancing) return;
    setIsEnhancing(true);
    setEnhancedProposal(null);
    try {
      const enhanced = await enhancePrompt(input);
      if (enhanced && enhanced !== input) {
        setEnhancedProposal(enhanced);
      }
    } catch (e) {
      console.error("Enhance failed", e);
    } finally {
      setIsEnhancing(false);
    }
  };

  const acceptEnhancement = () => {
    if (enhancedProposal) {
      setInput(enhancedProposal);
      setEnhancedProposal(null);
    }
  };

  const rejectEnhancement = () => {
    setEnhancedProposal(null);
  };

  const handleFeedback = (messageId: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        // Toggle logic: if clicking same type, remove feedback. Else set new type.
        const newFeedback = msg.feedback === type ? undefined : type;
        console.log(`User feedback for message ${messageId}: ${newFeedback}`);
        return { ...msg, feedback: newFeedback };
      }
      return msg;
    }));
  };

  const handleSend = async (textInput?: string) => {
    const textToSend = textInput || input;
    if (!textToSend.trim() || isLoading) return;

    // Clear any pending enhancements if user sends
    setEnhancedProposal(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setHistoryIndex(-1); // Reset history index on send
    setIsLoading(true);

    try {
      // Convert history for API
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await chatWithAI(userMsg.text, history, modelType);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I'm sorry, I couldn't generate a response.",
        timestamp: Date.now(),
        isThinking: modelType === 'thinking',
        sources: response.sources
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, something went wrong. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard Navigation for History
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
      return;
    }

    // Get only user messages for history navigation
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.text);
    if (userMessages.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = historyIndex === -1 ? userMessages.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(userMessages[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return; // Already at new input

      if (historyIndex === userMessages.length - 1) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        const newIndex = Math.min(userMessages.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        setInput(userMessages[newIndex]);
      }
    }
  };

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      recordingMimeTypeRef.current = mimeType;
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const result = reader.result as string;
          if (result) {
            const base64Audio = result.split(',')[1];
            setIsLoading(true); // Show loading state on Send button
            try {
               const text = await transcribeAudio(base64Audio, mimeType || 'audio/webm');
               if (text) {
                 const cleanText = text.trim();
                 setInput(prev => prev ? `${prev} ${cleanText}` : cleanText);
               }
            } catch (e) {
               console.error("Transcription failed", e);
            } finally {
               setIsLoading(false);
            }
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const decodePCM = (base64: string, ctx: AudioContext): AudioBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Gemini TTS uses 16-bit PCM, 24kHz, Mono, Little Endian
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    return buffer;
  };

  const playTTS = async (text: string, msgId: string) => {
    if (playingMessageId) return; // Prevent multiple plays
    setPlayingMessageId(msgId);
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        // Decode raw PCM from API
        const audioBuffer = decodePCM(base64Audio, audioContextRef.current);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setPlayingMessageId(null);
        source.start(0);
      } else {
        setPlayingMessageId(null);
      }
    } catch (e) {
      console.error("Audio playback error", e);
      setPlayingMessageId(null);
    }
  };

  // Helper to extract package IDs from text
  const extractPackageIds = (text: string): string[] => {
    const ids = new Set<string>();
    
    // Pattern 1: `Publisher.App` (inside backticks usually from AI)
    const backtickMatch = text.matchAll(/`([A-Z][a-zA-Z0-9]+\.[a-zA-Z0-9.]+)`/g);
    for (const match of backtickMatch) {
        if(match[1]) ids.add(match[1]);
    }

    // Pattern 2: winget install/upgrade <ID>
    const commandMatch = text.matchAll(/winget\s+(?:install|upgrade|uninstall)\s+(?:--id\s+)?([A-Z][a-zA-Z0-9]+\.[a-zA-Z0-9.]+)/gi);
    for (const match of commandMatch) {
        if(match[1]) ids.add(match[1]);
    }

    return Array.from(ids);
  };

  // Helper to extract JSON package lists from text
  const extractPackagesFromJSON = (text: string): WingetPackage[] | null => {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match) return null;
    
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
        return parsed as WingetPackage[];
      }
    } catch (e) {
      return null;
    }
    return null;
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-[var(--app-primary)] hover:opacity-90 text-white rounded-full shadow-lg shadow-indigo-900/30 transition-all transform hover:scale-105 flex items-center justify-center"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40">
          
          {/* Header */}
          <div className="p-4 border-b border-[var(--app-border)] bg-[var(--app-surface)] flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Bot size={20} className="text-[var(--app-primary)]" />
                <span className="font-semibold text-[var(--app-text)]">Winget Assistant</span>
              </div>
              <button 
                onClick={clearHistory}
                className="p-1.5 text-[var(--app-text-muted)] hover:text-red-400 hover:bg-[var(--app-bg)] rounded transition-colors"
                title="Clear History"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            {/* Model Selector */}
            <div className="flex bg-[var(--app-bg)] rounded-lg p-1 text-[10px] w-full">
              <button 
                onClick={() => setModelType('fast')}
                className={`flex-1 px-2 py-1.5 rounded flex items-center justify-center gap-1 transition-all ${modelType === 'fast' ? 'bg-amber-500/20 text-amber-400 font-medium shadow-sm' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                title="Fast Mode (Flash Lite)"
              >
                <Zap size={10} /> Fast
              </button>
              <button 
                onClick={() => setModelType('smart')}
                className={`flex-1 px-2 py-1.5 rounded flex items-center justify-center gap-1 transition-all ${modelType === 'smart' ? 'bg-[var(--app-primary)]/20 text-[var(--app-primary)] font-medium shadow-sm' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                title="Smart Mode (Pro)"
              >
                <Sparkles size={10} /> Smart
              </button>
              <button 
                onClick={() => setModelType('thinking')}
                className={`flex-1 px-2 py-1.5 rounded flex items-center justify-center gap-1 transition-all ${modelType === 'thinking' ? 'bg-rose-500/20 text-rose-400 font-medium shadow-sm' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                title="Thinking Mode"
              >
                <BrainCircuit size={10} /> Think
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--app-bg)]/50">
            {messages.map((msg) => {
              const packageIds = msg.role === 'model' ? extractPackageIds(msg.text) : [];
              const jsonPackages = msg.role === 'model' ? extractPackagesFromJSON(msg.text) : null;
              
              return (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[90%] rounded-2xl p-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-[var(--app-primary)] text-white rounded-br-none' 
                    : 'bg-[var(--app-surface)] text-[var(--app-text)] rounded-bl-none border border-[var(--app-border)]'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  
                  {/* JSON Packages Action */}
                  {jsonPackages && jsonPackages.length > 0 && onShowResults && (
                     <button
                        onClick={() => onShowResults(jsonPackages)}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-[var(--app-primary)] hover:opacity-90 text-white rounded-lg text-xs font-bold transition-all shadow-lg"
                     >
                       <Grid size={14} />
                       View {jsonPackages.length} Results in Grid
                     </button>
                  )}

                  {/* Detected Package IDs */}
                  {packageIds.length > 0 && !jsonPackages && (
                    <div className="mt-3 bg-[var(--app-bg)]/50 rounded-lg p-2 border border-[var(--app-border)]/50">
                      <div className="text-[10px] text-[var(--app-text-muted)] uppercase font-bold mb-1 flex items-center gap-1">
                        <Box size={10} /> Related Packages
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {packageIds.map(id => (
                          <button
                            key={id}
                            onClick={() => copyId(id)}
                            className="flex items-center gap-1 px-2 py-1 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] rounded text-xs font-mono text-[var(--app-primary)] border border-[var(--app-border)] hover:border-[var(--app-primary)]/50 transition-all group"
                            title="Copy ID"
                          >
                            {id}
                            {copiedId === id ? (
                              <span className="flex items-center gap-1 text-green-400">
                                <Check size={10} /> <span className="text-[10px] font-sans">Copied!</span>
                              </span>
                            ) : (
                              <Copy size={10} className="opacity-50 group-hover:opacity-100" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sources / Grounding */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[var(--app-border)]/50">
                       <div className="text-[10px] text-[var(--app-text-muted)] uppercase font-bold mb-1 flex items-center gap-1">
                        <LinkIcon size={10} /> Sources
                      </div>
                      <div className="flex flex-col gap-1">
                        {msg.sources.map((source, idx) => (
                          <a 
                            key={idx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[var(--app-primary)] hover:underline truncate"
                          >
                            {source.title || source.uri}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.role === 'model' && (
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--app-border)]/50 pt-2">
                      <div className="flex items-center gap-2">
                        {msg.isThinking && <span className="text-[10px] text-rose-400 flex items-center gap-1"><BrainCircuit size={10} /> Deep Thought</span>}
                        {!msg.isThinking && <span className="text-[10px] text-[var(--app-text-muted)]">AI Generated</span>}
                        
                        {/* Feedback Buttons */}
                        <div className="flex items-center gap-1 ml-2 border-l border-[var(--app-border)]/50 pl-2">
                          <button 
                            onClick={() => handleFeedback(msg.id, 'up')}
                            className={`p-1 rounded transition-colors ${msg.feedback === 'up' ? 'text-green-400 bg-green-900/20' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                            title="Helpful"
                          >
                            <ThumbsUp size={12} />
                          </button>
                          <button 
                            onClick={() => handleFeedback(msg.id, 'down')}
                            className={`p-1 rounded transition-colors ${msg.feedback === 'down' ? 'text-red-400 bg-red-900/20' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                            title="Not Helpful"
                          >
                            <ThumbsDown size={12} />
                          </button>
                        </div>
                      </div>

                      <button 
                        onClick={() => playTTS(msg.text, msg.id)}
                        disabled={!!playingMessageId}
                        className={`p-1 rounded hover:bg-[var(--app-bg)] transition-colors ${playingMessageId === msg.id ? 'text-green-400' : 'text-[var(--app-text-muted)]'}`}
                        title="Read aloud"
                      >
                         <Volume2 size={14} className={playingMessageId === msg.id ? 'animate-pulse' : ''} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )})}
            
            {/* Suggestions for empty/new chat */}
            {messages.length === 1 && (
               <div className="flex flex-wrap gap-2 mt-4 px-2">
                 {SUGGESTIONS.map(s => (
                   <button 
                     key={s}
                     onClick={() => handleSend(s)}
                     className="px-3 py-1.5 bg-[var(--app-surface)] hover:bg-[var(--app-border)] border border-[var(--app-border)] rounded-full text-xs text-[var(--app-primary)] hover:text-[var(--app-text)] transition-colors"
                   >
                     {s}
                   </button>
                 ))}
               </div>
            )}

            {isLoading && !isRecording && (
              <div className="flex justify-start">
                <div className="bg-[var(--app-surface)] rounded-2xl rounded-bl-none p-3 border border-[var(--app-border)] flex items-center space-x-2">
                  <Loader2 size={16} className="animate-spin text-[var(--app-primary)]" />
                  <span className="text-xs text-[var(--app-text-muted)]">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-[var(--app-surface)] border-t border-[var(--app-border)] relative">
            
            {/* Enhancement Proposal Overlay */}
            {enhancedProposal && (
              <div className="absolute bottom-full left-0 w-full mb-0 p-3 bg-[var(--app-surface)]/95 backdrop-blur-sm border-t border-[var(--app-border)] shadow-xl animate-in slide-in-from-bottom-2 fade-in z-20">
                <div className="flex justify-between items-start mb-1">
                   <p className="text-[10px] text-[var(--app-primary)] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={10} /> AI Suggestion
                   </p>
                   <button onClick={rejectEnhancement} className="text-[var(--app-text-muted)] hover:text-[var(--app-text)]">
                     <X size={12} />
                   </button>
                </div>
                <p className="text-xs text-[var(--app-text)] italic mb-3 bg-[var(--app-bg)]/50 p-2 rounded border border-[var(--app-border)]/50">
                  "{enhancedProposal}"
                </p>
                <div className="flex gap-2">
                   <button 
                     onClick={acceptEnhancement}
                     className="flex-1 py-1.5 bg-[var(--app-primary)] hover:opacity-90 text-white text-xs rounded font-medium flex items-center justify-center gap-1 transition-colors"
                   >
                     <Check size={12} /> Accept
                   </button>
                   <button 
                     onClick={rejectEnhancement}
                     className="flex-1 py-1.5 bg-[var(--app-border)] hover:bg-[var(--app-bg)] text-[var(--app-text-muted)] text-xs rounded font-medium flex items-center justify-center gap-1 transition-colors"
                   >
                     <X size={12} /> Reject
                   </button>
                </div>
              </div>
            )}

            <div className="relative flex items-center z-10">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Listening..." : "Ask about packages..."}
                disabled={isRecording || isLoading}
                className={`w-full bg-[var(--app-bg)] border rounded-full py-2.5 pl-4 pr-32 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 transition-all ${
                  isRecording 
                  ? 'border-red-500/50 ring-2 ring-red-500/20 placeholder-red-400 bg-red-950/10' 
                  : 'border-[var(--app-border)] focus:ring-[var(--app-primary)]/50'
                }`}
              />
              <div className="absolute right-1 flex items-center space-x-1">
                {/* Enhance Prompt Button */}
                <button
                   onClick={handleEnhance}
                   disabled={!input.trim() || isEnhancing || isLoading || isRecording || !!enhancedProposal}
                   className={`p-1.5 rounded-full transition-all ${
                     isEnhancing ? 'text-[var(--app-primary)] animate-spin' : 'text-[var(--app-text-muted)] hover:text-[var(--app-primary)] hover:bg-[var(--app-surface)]'
                   }`}
                   title="Enhance prompt with AI"
                >
                   <Sparkles size={16} />
                </button>

                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={`p-1.5 rounded-full transition-all ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse scale-110 shadow-lg shadow-red-500/30' 
                      : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface)]'
                  }`}
                  title="Hold to speak"
                >
                  {isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading || isRecording}
                  className="p-1.5 bg-[var(--app-primary)] text-white rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
             {isRecording && (
                <div className="absolute -top-12 left-0 w-full flex justify-center pointer-events-none">
                  <span className="bg-[var(--app-surface)] text-red-400 text-xs px-3 py-1.5 rounded-full border border-red-500/30 shadow-lg animate-bounce font-medium">
                    Release to transcribe
                  </span>
                </div>
             )}
          </div>
        </div>
      )}
    </>
  );
};
