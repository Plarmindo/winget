
import React, { useState, useRef, useEffect } from 'react';
import { Grid, Zap, RefreshCw, Shield, Trash2, LayoutGrid, Plus, Sparkles, Edit2, X } from 'lucide-react';
import { AppSettings, AppMode } from '../types';

interface WelcomeScreenProps {
  settings: AppSettings;
  setMode: (mode: AppMode) => void;
  handleSearch: (q: string) => void;
  openSettings: () => void;
  onAddCustomSubject?: (subject: string) => void;
  onRemoveCustomSubject?: (subject: string) => void;
}

const SUGGESTION_POOL = [
  "Audio", "Backup", "Browsers", "Chat", "Cloud", "Coding", "Compression", 
  "Databases", "Design", "DevOps", "Drivers", "Editors", "Education", 
  "Email", "Emulator", "Finance", "Games", "Graphics", "IDE", "IoT",
  "Media", "Messaging", "Network", "Office", "PDF", "Photography", 
  "Player", "Privacy", "Programming", "Recorder", "Remote", "Runtime", "Security", 
  "Social", "Storage", "System", "Terminal", "Torrent", "Utilities", 
  "Video", "Virtualization", "VPN", "Web", "Writing"
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ settings, setMode, handleSearch, openSettings, onAddCustomSubject, onRemoveCustomSubject }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isAdding]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewSubject(val);
    
    if (val.trim()) {
        const lower = val.toLowerCase();
        const matches = SUGGESTION_POOL.filter(s => 
            s.toLowerCase().includes(lower) && 
            !settings.customSubjects.some(existing => existing.toLowerCase() === s.toLowerCase())
        ).slice(0, 5);
        setSuggestions(matches);
    } else {
        setSuggestions([]);
    }
  };

  const handleCommit = () => {
    if (newSubject.trim() && onAddCustomSubject) {
        onAddCustomSubject(newSubject.trim());
    }
    setNewSubject('');
    setIsAdding(false);
    setSuggestions([]);
  };

  const handleSuggestionClick = (subj: string) => {
    if (onAddCustomSubject) {
        onAddCustomSubject(subj);
    }
    setNewSubject('');
    setIsAdding(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleCommit();
    } else if (e.key === 'Escape') {
        setNewSubject('');
        setIsAdding(false);
        setSuggestions([]);
    } else if (e.key === 'Tab' && suggestions.length > 0) {
        e.preventDefault();
        setNewSubject(suggestions[0]);
    }
  };

  const handleBlur = () => {
      // Small delay to allow suggestion click to process
      setTimeout(() => {
          handleCommit();
      }, 200);
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="text-center mb-12">
         <h1 className="text-4xl font-extrabold text-[var(--app-text)] tracking-tight mb-4">
           {settings.activePackageManager === 'winget' ? 'WinGet Web Interface' : `${settings.activePackageManager.charAt(0).toUpperCase() + settings.activePackageManager.slice(1)} Web Interface`}
         </h1>
         <p className="text-lg text-[var(--app-text-muted)] max-w-2xl mx-auto">
           The modern way to explore, install, and manage {settings.activePackageManager} applications. 
           Generated scripts are processed locally or via your preferred AI provider.
         </p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <button onClick={() => handleSearch("POPULAR_ESSENTIALS")} className="group relative overflow-hidden p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-primary)]/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg">
             <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Grid size={100} /></div>
             <div className="bg-[var(--app-primary)]/20 p-3 rounded-xl inline-flex text-[var(--app-primary)] mb-4 group-hover:scale-110 transition-transform"><Zap size={32} /></div>
             <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Browse Essentials</h3>
             <p className="text-sm text-[var(--app-text-muted)]">Discover popular tools for developers, gamers, and power users.</p>
          </button>
          <button onClick={() => setMode('upgrade')} className="group relative overflow-hidden p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-emerald-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg">
             <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Shield size={100} /></div>
             <div className="bg-emerald-900/30 p-3 rounded-xl inline-flex text-emerald-400 mb-4 group-hover:scale-110 transition-transform"><RefreshCw size={32} /></div>
             <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Check Upgrades</h3>
             <p className="text-sm text-[var(--app-text-muted)]">Identify installed apps and generate an upgrade script.</p>
          </button>
           <button onClick={() => setMode('uninstall')} className="group relative overflow-hidden p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-red-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg">
             <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><LayoutGrid size={100} /></div>
             <div className="bg-red-900/30 p-3 rounded-xl inline-flex text-red-400 mb-4 group-hover:scale-110 transition-transform"><Trash2 size={32} /></div>
             <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Uninstall Apps</h3>
             <p className="text-sm text-[var(--app-text-muted)]">Clean up bloatware and remove unused applications silently.</p>
          </button>
       </div>
       
       <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
             <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">Quick Search</p>
             {settings.customSubjects.length > 0 && onRemoveCustomSubject && (
                <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className={`p-1 rounded-full transition-colors ${isEditing ? 'bg-[var(--app-primary)] text-white' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                  title={isEditing ? "Done Editing" : "Edit / Remove Items"}
                >
                   <Edit2 size={12} />
                </button>
             )}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
             {settings.customSubjects.map(subject => (
                <button 
                   key={subject} 
                   onClick={() => {
                      if (isEditing && onRemoveCustomSubject) {
                         onRemoveCustomSubject(subject);
                      } else {
                         handleSearch(subject.toLowerCase());
                      }
                   }} 
                   className={`px-4 py-2 rounded-full text-sm transition-all flex items-center gap-2 ${
                      isEditing 
                         ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white animate-pulse' 
                         : 'bg-[var(--app-surface)] hover:bg-[var(--app-border)] border border-[var(--app-border)]/50 text-[var(--app-text)]'
                   }`}
                >
                   {subject}
                   {isEditing && <X size={12} />}
                </button>
             ))}
             
             {!isEditing && (
               <>
                 {isAdding ? (
                   <div className="relative">
                     <input 
                        ref={inputRef}
                        type="text"
                        value={newSubject}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        autoCorrect="on"
                        spellCheck={true}
                        className="px-4 py-2 bg-[var(--app-surface)] border border-[var(--app-primary)] rounded-full text-sm text-[var(--app-text)] focus:outline-none min-w-[120px] text-center"
                        placeholder="Type category..."
                     />
                     {suggestions.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-xl z-20 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                            {suggestions.map(s => (
                                <button
                                    key={s}
                                    onMouseDown={() => handleSuggestionClick(s)}
                                    className="px-3 py-2 text-xs text-left text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg)] border-b border-[var(--app-border)]/50 last:border-0 flex items-center gap-2"
                                >
                                    <Sparkles size={10} className="text-[var(--app-primary)]" />
                                    {s}
                                </button>
                            ))}
                        </div>
                     )}
                   </div>
                 ) : (
                   <button 
                      onClick={() => setIsAdding(true)} 
                      className="px-3 py-2 text-[var(--app-text-muted)] hover:text-[var(--app-primary)] transition-colors border border-dashed border-[var(--app-border)] rounded-full flex items-center gap-1 text-sm"
                   >
                     <Plus size={14} /> Add
                   </button>
                 )}
               </>
             )}
          </div>
       </div>
    </div>
  );
};
