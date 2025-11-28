import React from 'react';
import { Grid, Zap, RefreshCw, Shield, Trash2, LayoutGrid, Plus } from 'lucide-react';
import { AppSettings, AppMode } from '../types';

interface WelcomeScreenProps {
  settings: AppSettings;
  setMode: (mode: AppMode) => void;
  handleSearch: (q: string) => void;
  openSettings: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ settings, setMode, handleSearch, openSettings }) => {
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
          <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider mb-4">Quick Search</p>
          <div className="flex flex-wrap justify-center gap-3">
             {settings.customSubjects.map(subject => (
                <button key={subject} onClick={() => handleSearch(subject.toLowerCase())} className="px-4 py-2 bg-[var(--app-surface)] hover:bg-[var(--app-border)] border border-[var(--app-border)]/50 rounded-full text-sm text-[var(--app-text)] transition-colors">
                   {subject}
                </button>
             ))}
             <button onClick={openSettings} className="px-3 py-2 text-[var(--app-text-muted)] hover:text-[var(--app-primary)] transition-colors border border-dashed border-[var(--app-border)] rounded-full flex items-center gap-1 text-sm">
               <Plus size={14} /> Add
             </button>
          </div>
       </div>
    </div>
  );
};
