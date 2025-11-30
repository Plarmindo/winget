import React, { useState, useRef } from 'react';
import { Grid, Zap, RefreshCw, Shield, Trash2, LayoutGrid, Plus, Sparkles, Edit2, X } from 'lucide-react';
import { useAppStore } from '../stores/store';

interface WelcomeScreenProps {
  handleSearch: (q: string) => void;
  openSettings: () => void;
}

const SUGGESTION_POOL = ["Audio", "Backup", "Browsers", "Chat", "Cloud", "Coding", "Design", "DevOps", "Games", "Media", "Security", "Utilities", "Video"];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ handleSearch, openSettings }) => {
  const { settings, updateSettings, setMode } = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  
  const handleAdd = (subj: string) => {
     if(subj.trim() && !settings.customSubjects.includes(subj)) {
        updateSettings({ customSubjects: [...settings.customSubjects, subj] });
        setIsAdding(false); setNewSubject('');
     }
  };

  const handleRemove = (subj: string) => {
     updateSettings({ customSubjects: settings.customSubjects.filter(s => s !== subj) });
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="text-center mb-12">
         <h1 className="text-4xl font-extrabold text-[var(--app-text)] tracking-tight mb-4">
           {settings.activePackageManager === 'winget' ? 'WinGet Web Interface' : `${settings.activePackageManager.charAt(0).toUpperCase() + settings.activePackageManager.slice(1)} Web Interface`}
         </h1>
         <p className="text-lg text-[var(--app-text-muted)] max-w-2xl mx-auto">
           The modern way to explore, install, and manage system applications.
         </p>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <button onClick={() => handleSearch("POPULAR_ESSENTIALS")} className="p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-primary)]/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg">
             <div className="bg-[var(--app-primary)]/20 p-3 rounded-xl inline-flex text-[var(--app-primary)] mb-4"><Zap size={32} /></div>
             <h3 className="text-xl font-bold mb-2">Browse Essentials</h3>
             <p className="text-sm text-[var(--app-text-muted)]">Discover popular tools for developers and power users.</p>
          </button>
          <button onClick={() => setMode('upgrade')} className="p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-emerald-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg">
             <div className="bg-emerald-900/30 p-3 rounded-xl inline-flex text-emerald-400 mb-4"><RefreshCw size={32} /></div>
             <h3 className="text-xl font-bold mb-2">Check Upgrades</h3>
             <p className="text-sm text-[var(--app-text-muted)]">Identify installed apps and generate an upgrade script.</p>
          </button>
          <button onClick={() => setMode('uninstall')} className="p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-red-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg">
             <div className="bg-red-900/30 p-3 rounded-xl inline-flex text-red-400 mb-4"><Trash2 size={32} /></div>
             <h3 className="text-xl font-bold mb-2">Uninstall Apps</h3>
             <p className="text-sm text-[var(--app-text-muted)]">Clean up bloatware and remove unused applications.</p>
          </button>
       </div>
       <div className="text-center">
          <div className="flex justify-center gap-3 flex-wrap">
             {settings.customSubjects.map(s => (
                <button key={s} onClick={() => isEditing ? handleRemove(s) : handleSearch(s.toLowerCase())} className={`px-4 py-2 rounded-full text-sm border ${isEditing ? 'border-red-500 text-red-500' : 'bg-[var(--app-surface)] border-[var(--app-border)]'}`}>{s} {isEditing && <X size={12}/>}</button>
             ))}
             <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-[var(--app-text-muted)]"><Edit2 size={14}/></button>
          </div>
       </div>
    </div>
  );
};