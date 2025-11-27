import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Package, Terminal, Loader2, Info as InfoIcon, Github, Menu, ShoppingBag, Download, RefreshCw, Trash2, ClipboardPaste, ArrowRight, ChevronLeft, ChevronRight, Command, Monitor, Zap, X, Grid, Shield, LayoutGrid, PlusCircle, Ban, XCircle, Settings, HardDrive, Database, Sparkles, BrainCircuit, Activity, Moon, Sun, MonitorSmartphone, Check, Palette, Plus, Minus, FileText, Edit2, Save, RotateCcw, Copy, Undo2, ArrowUpCircle, ArrowDownCircle, Cpu, Bug, Construction } from 'lucide-react';
import { WingetPackage, AppMode, AppSettings, ChatModelType, AppTheme } from './types';
import { searchPackages, parseWingetOutput, generateAppDetailsPrompt, generateAlternativesPrompt, generateEvaluationPrompt } from './services/wingetService';
import { PackageCard } from './components/PackageCard';
import { ScriptDrawer } from './components/ScriptDrawer';
import { ChatInterface } from './components/ChatInterface';

const PRESET_CATEGORIES = [
  "Development", "Gaming", "Productivity", "Utilities", "Multimedia", "System"
];

const CART_STORAGE_KEY = 'winget_cart_storage';
const SETTINGS_STORAGE_KEY = 'winget_app_settings';
const CHAT_STORAGE_KEY = 'winget_chat_history';

const DEFAULT_THEMES: AppTheme[] = [
  {
    id: 'default',
    name: 'Default Slate',
    colors: {
      bg: '#0f172a', // slate-900
      surface: '#1e293b', // slate-800
      border: '#334155', // slate-700
      text: '#f8fafc', // slate-50
      textMuted: '#94a3b8', // slate-400
      primary: '#2563eb', // blue-600
      primaryHover: '#3b82f6' // blue-500
    }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      bg: '#000000',
      surface: '#111111',
      border: '#333333',
      text: '#ffffff',
      textMuted: '#888888',
      primary: '#6366f1', // indigo-500
      primaryHover: '#818cf8'
    }
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    colors: {
      bg: '#0c4a6e', // sky-900
      surface: '#075985', // sky-800
      border: '#0ea5e9', // sky-500
      text: '#f0f9ff', // sky-50
      textMuted: '#bae6fd', // sky-200
      primary: '#0284c7', // sky-600
      primaryHover: '#38bdf8'
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: {
      bg: '#09090b', 
      surface: '#18181b', 
      border: '#27272a',
      text: '#e4e4e7',
      textMuted: '#a1a1aa',
      primary: '#d946ef', // fuchsia-500
      primaryHover: '#e879f9'
    }
  }
];

interface CommandItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
}

const CommandItem: React.FC<CommandItemProps> = ({ icon, label, shortcut, onClick, active }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
      active ? 'bg-[var(--app-surface)] text-[var(--app-text)]' : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    {shortcut && (
      <span className="text-xs font-mono bg-[var(--app-bg)] px-1.5 py-0.5 rounded text-[var(--app-text-muted)] border border-[var(--app-border)]">
        {shortcut}
      </span>
    )}
  </button>
);

// Simple Custom Tooltip Component
const Tooltip: React.FC<{ children: React.ReactNode; content: string }> = ({ children, content }) => {
  return (
    <div className="group relative flex flex-col items-center">
      {children}
      <div className="absolute top-full mt-2 px-3 py-1.5 bg-[var(--app-surface)] text-xs text-[var(--app-text)] rounded-md border border-[var(--app-border)] shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--app-surface)] border-t border-l border-[var(--app-border)] transform rotate-45"></div>
        {content}
      </div>
    </div>
  );
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClearData: (type: 'cart' | 'chat' | 'all') => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings, onClearData }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'data' | 'about'>('general');
  const [newSubject, setNewSubject] = useState('');
  
  // Theme Editor State
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editedTheme, setEditedTheme] = useState<AppTheme | null>(null);

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'ai', label: 'AI Model', icon: <BrainCircuit size={16} /> },
    { id: 'data', label: 'Data', icon: <Database size={16} /> },
    { id: 'about', label: 'About', icon: <InfoIcon size={16} /> },
  ];

  const handleAddSubject = () => {
    if (newSubject.trim() && !settings.customSubjects.includes(newSubject.trim())) {
      onUpdateSettings({
        ...settings,
        customSubjects: [...settings.customSubjects, newSubject.trim()]
      });
      setNewSubject('');
    }
  };

  const handleRemoveSubject = (subject: string) => {
    onUpdateSettings({
      ...settings,
      customSubjects: settings.customSubjects.filter(s => s !== subject)
    });
  };

  const startEditingTheme = (theme: AppTheme) => {
    // If it's a default theme, we should ideally clone it to a new custom theme
    if (!theme.isCustom) {
       const clonedTheme: AppTheme = {
         ...theme,
         id: `custom-${Date.now()}`,
         name: `${theme.name} (Copy)`,
         isCustom: true
       };
       setEditedTheme(clonedTheme);
       setEditingThemeId(clonedTheme.id);
    } else {
       setEditingThemeId(theme.id);
       setEditedTheme({ ...theme });
    }
  };

  const handleSaveTheme = () => {
    if (!editedTheme) return;
    
    // Check if updating existing or adding new
    const existingIndex = settings.themes.findIndex(t => t.id === editedTheme.id);
    let newThemes = [...settings.themes];
    
    if (existingIndex >= 0) {
      newThemes[existingIndex] = editedTheme;
    } else {
      newThemes.push(editedTheme);
    }
    
    onUpdateSettings({
      ...settings,
      themes: newThemes,
      activeThemeId: editedTheme.id
    });
    setEditingThemeId(null);
    setEditedTheme(null);
  };

  const createNewTheme = () => {
    const newTheme: AppTheme = {
      id: `custom-${Date.now()}`,
      name: 'New Custom Theme',
      colors: { ...DEFAULT_THEMES[0].colors },
      isCustom: true
    };
    setEditedTheme(newTheme);
    setEditingThemeId(newTheme.id);
  };

  const deleteTheme = (id: string) => {
    if (window.confirm("Delete this theme?")) {
      const newThemes = settings.themes.filter(t => t.id !== id);
      const newActiveId = settings.activeThemeId === id ? DEFAULT_THEMES[0].id : settings.activeThemeId;
      onUpdateSettings({
        ...settings,
        themes: newThemes,
        activeThemeId: newActiveId
      });
    }
  };

  const handleExportData = () => {
     const exportData = {
        settings: JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}'),
        cart: JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]'),
        chat: JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]'),
        exportedAt: new Date().toISOString()
     };
     
     const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `winget-web-backup-${new Date().toISOString().split('T')[0]}.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
       try {
          const result = ev.target?.result as string;
          const parsed = JSON.parse(result);
          
          if (parsed.settings) localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(parsed.settings));
          if (parsed.cart) localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(parsed.cart));
          if (parsed.chat) localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(parsed.chat));
          
          alert("Data imported successfully. The page will refresh to apply changes.");
          window.location.reload();
       } catch(err) {
          alert("Failed to parse import file. Is it a valid JSON backup?");
          console.error(err);
       }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] text-[var(--app-text)]" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-6 border-b border-[var(--app-border)]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings size={20} className="text-[var(--app-text-muted)]" /> Settings
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--app-bg)] rounded-lg text-[var(--app-text-muted)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-48 border-r border-[var(--app-border)] p-4 space-y-2 bg-[var(--app-bg)]/30 hidden sm:block">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]' 
                    : 'text-[var(--app-text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--app-text)]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile Tabs */}
          <div className="sm:hidden flex border-b border-[var(--app-border)] overflow-x-auto">
             {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-xs font-medium whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'text-[var(--app-primary)] border-b-2 border-[var(--app-primary)] bg-[var(--app-primary)]/5' 
                    : 'text-[var(--app-text-muted)]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--app-surface)]">
            
            {activeTab === 'general' && (
              <div className="space-y-8">
                 {/* Theme Selector / Editor */}
                 <div>
                   <div className="flex items-center justify-between mb-4">
                      <div>
                         <h3 className="text-lg font-semibold">Themes</h3>
                         <p className="text-xs text-[var(--app-text-muted)]">Select or customize the interface look.</p>
                      </div>
                      {!editingThemeId && (
                         <button 
                           onClick={createNewTheme}
                           className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[var(--app-primary)] text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium"
                         >
                            <Plus size={14} /> New Custom Theme
                         </button>
                      )}
                   </div>

                   {editingThemeId && editedTheme ? (
                      <div className="bg-[var(--app-bg)]/50 p-5 rounded-xl border border-[var(--app-border)] mb-6 animate-in slide-in-from-right-4 relative">
                         <div className="flex items-center justify-between mb-6">
                            <h4 className="font-semibold flex items-center gap-2">
                               <Palette size={16} className="text-[var(--app-primary)]" />
                               {editedTheme.id.startsWith('custom-') ? 'Edit Custom Theme' : 'Edit Theme'}
                            </h4>
                            <div className="flex gap-2">
                               <button 
                                 onClick={() => {
                                    const original = settings.themes.find(t => t.id === editingThemeId);
                                    if(original) setEditedTheme({ ...original, isCustom: true });
                                 }}
                                 className="p-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded border border-transparent hover:border-[var(--app-border)] transition-all" 
                                 title="Reset Changes"
                               >
                                 <Undo2 size={16} />
                               </button>
                               <button onClick={handleSaveTheme} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm">
                                  <Save size={14} /> Save
                               </button>
                               <button onClick={() => { setEditingThemeId(null); setEditedTheme(null); }} className="p-1.5 bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded border border-[var(--app-border)] hover:border-red-500/50 transition-colors" title="Cancel">
                                  <X size={16} />
                               </button>
                            </div>
                         </div>
                         <div className="space-y-4">
                            <div>
                               <label className="text-xs font-semibold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">Theme Name</label>
                               <input 
                                 type="text" 
                                 value={editedTheme.name}
                                 onChange={(e) => setEditedTheme({ ...editedTheme, name: e.target.value })}
                                 className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:ring-1 focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)] outline-none"
                                 placeholder="e.g., Neon Nights"
                               />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               {Object.entries(editedTheme.colors).map(([key, val]) => (
                                  <div key={key} className="bg-[var(--app-surface)] p-2 rounded-lg border border-[var(--app-border)] flex items-center gap-3">
                                     <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-[var(--app-border)] shadow-sm flex-shrink-0">
                                       <input 
                                          type="color" 
                                          value={val}
                                          onChange={(e) => setEditedTheme({ 
                                            ...editedTheme, 
                                            colors: { ...editedTheme.colors, [key]: e.target.value } 
                                          })}
                                          className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-none p-0"
                                        />
                                     </div>
                                     <div className="flex-1 min-w-0">
                                        <label className="text-[10px] font-bold text-[var(--app-text-muted)] block capitalize truncate mb-0.5">
                                           {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </label>
                                        <div className="flex items-center gap-1">
                                           <span className="text-xs font-mono text-[var(--app-text)]">{val}</span>
                                        </div>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   ) : (
                      <div className="grid grid-cols-2 gap-3 mb-6">
                          {settings.themes.map(t => (
                            <div
                              key={t.id}
                              className={`group relative p-3 rounded-xl border text-sm font-medium flex items-center justify-between cursor-pointer transition-all ${
                                settings.activeThemeId === t.id 
                                ? 'bg-[var(--app-primary)]/10 border-[var(--app-primary)] text-[var(--app-primary)] ring-1 ring-[var(--app-primary)]/20' 
                                : 'bg-[var(--app-bg)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:border-[var(--app-text-muted)]/50'
                              }`}
                              onClick={() => onUpdateSettings({ ...settings, activeThemeId: t.id })}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: t.colors.primary }}></div>
                                <span>{t.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 {settings.activeThemeId === t.id && <Check size={16} className="text-[var(--app-primary)]" />}
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                       onClick={() => startEditingTheme(t)} 
                                       className="p-1 hover:bg-[var(--app-surface)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-primary)]" 
                                       title={t.isCustom ? "Edit" : "Clone & Edit"}
                                    >
                                       {t.isCustom ? <Edit2 size={12} /> : <Copy size={12} />}
                                    </button>
                                    {t.isCustom && (
                                       <button onClick={() => deleteTheme(t.id)} className="p-1 hover:bg-[var(--app-surface)] rounded text-[var(--app-text-muted)] hover:text-red-500">
                                          <Trash2 size={12} />
                                       </button>
                                    )}
                                 </div>
                              </div>
                            </div>
                          ))}
                      </div>
                   )}
                   
                   <h3 className="text-lg font-semibold mb-4">View Options</h3>
                   <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50 mb-4">
                       <div className="flex items-center gap-3">
                          <Grid size={20} className="text-[var(--app-text-muted)]" />
                          <div>
                            <p className="font-medium text-[var(--app-text)]">Items Per Page</p>
                            <p className="text-xs text-[var(--app-text-muted)]">Set how many cards to display at once (Min 3)</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            min="3"
                            max="100"
                            value={settings.itemsPerPage || 9}
                            onChange={(e) => {
                               const val = parseInt(e.target.value);
                               if (!isNaN(val) && val >= 0) {
                                  onUpdateSettings({ ...settings, itemsPerPage: val });
                               }
                            }}
                            className="w-20 bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--app-primary)] focus:ring-1 focus:ring-[var(--app-primary)]"
                          />
                          <span className="text-xs text-[var(--app-text-muted)]">cards</span>
                       </div>
                   </div>

                    {/* Compact Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50 mb-6">
                       <div className="flex items-center gap-3">
                          <Minus size={20} className="text-[var(--app-text-muted)]" />
                          <div>
                            <p className="font-medium text-[var(--app-text)]">Compact Mode</p>
                            <p className="text-xs text-[var(--app-text-muted)]">Reduce spacing and padding for denser information.</p>
                          </div>
                       </div>
                        <button 
                          onClick={() => onUpdateSettings({ ...settings, compactMode: !settings.compactMode })}
                          className={`w-12 h-6 rounded-full transition-colors relative ${settings.compactMode ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-border)]'}`}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.compactMode ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                   </div>

                   <h3 className="text-lg font-semibold mb-4">Dashboard Shortcuts</h3>
                   <div className="bg-[var(--app-bg)]/50 p-4 rounded-xl border border-[var(--app-border)]/50 space-y-4">
                      <div className="flex gap-2">
                        <input 
                           type="text" 
                           placeholder="New subject (e.g. 'Browsers')" 
                           className="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)] focus:ring-1 focus:ring-[var(--app-primary)]"
                           value={newSubject}
                           onChange={e => setNewSubject(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                        />
                        <button 
                          onClick={handleAddSubject}
                          disabled={!newSubject.trim()}
                          className="px-4 bg-[var(--app-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {settings.customSubjects.map(subject => (
                           <div key={subject} className="flex items-center gap-1 bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] px-3 py-1.5 rounded-full text-xs font-medium shadow-sm">
                              {subject}
                              <button onClick={() => handleRemoveSubject(subject)} className="hover:text-red-400 ml-1 p-0.5 rounded-full hover:bg-[var(--app-bg)] transition-colors">
                                <X size={12} />
                              </button>
                           </div>
                        ))}
                        {settings.customSubjects.length === 0 && (
                          <span className="text-xs text-[var(--app-text-muted)] italic">No custom shortcuts added.</span>
                        )}
                      </div>
                   </div>

                   <h3 className="text-lg font-semibold mt-6 mb-4">Accessibility</h3>
                   <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50">
                        <div className="flex items-center gap-3">
                           <Activity size={20} className="text-[var(--app-text-muted)]" />
                           <div>
                             <p className="font-medium text-[var(--app-text)]">Reduced Motion</p>
                             <p className="text-xs text-[var(--app-text-muted)]">Minimize animations across the interface</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => onUpdateSettings({ ...settings, reducedMotion: !settings.reducedMotion })}
                          className={`w-12 h-6 rounded-full transition-colors relative ${settings.reducedMotion ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-border)]'}`}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.reducedMotion ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                     </div>

                     <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50">
                        <div className="flex items-center gap-3">
                           <Sun size={20} className="text-amber-400" />
                           <div>
                             <p className="font-medium text-[var(--app-text)]">High Contrast</p>
                             <p className="text-xs text-[var(--app-text-muted)]">Increase visual distinction for better readability</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => onUpdateSettings({ ...settings, highContrast: !settings.highContrast })}
                          className={`w-12 h-6 rounded-full transition-colors relative ${settings.highContrast ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-border)]'}`}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.highContrast ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                     </div>
                   </div>
                 </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                   <h3 className="text-lg font-semibold mb-4">Default Model</h3>
                   <p className="text-sm text-[var(--app-text-muted)] mb-4">Choose the default AI model to use for chat and suggestions.</p>
                   
                   <div className="grid grid-cols-1 gap-3">
                      {[
                        { id: 'fast', label: 'Flash Lite', desc: 'Fastest responses, good for simple queries.', icon: <Zap size={16} /> },
                        { id: 'smart', label: 'Pro (Smart)', desc: 'Balanced performance and reasoning.', icon: <Sparkles size={16} /> },
                        { id: 'thinking', label: 'Thinking', desc: 'Deep reasoning for complex tasks. Slower.', icon: <BrainCircuit size={16} /> }
                      ].map((model) => (
                        <button
                          key={model.id}
                          onClick={() => onUpdateSettings({ ...settings, defaultModel: model.id as ChatModelType })}
                          className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                            settings.defaultModel === model.id 
                              ? 'bg-[var(--app-primary)]/10 border-[var(--app-primary)]/50 ring-1 ring-[var(--app-primary)]/50' 
                              : 'bg-[var(--app-bg)]/50 border-[var(--app-border)]/50 hover:bg-[var(--app-bg)]'
                          }`}
                        >
                           <div className={`p-2 rounded-lg mt-0.5 ${settings.defaultModel === model.id ? 'bg-[var(--app-primary)] text-white' : 'bg-[var(--app-border)] text-[var(--app-text-muted)]'}`}>
                              {model.icon}
                           </div>
                           <div>
                             <p className={`font-semibold ${settings.defaultModel === model.id ? 'text-[var(--app-primary)]' : 'text-[var(--app-text)]'}`}>{model.label}</p>
                             <p className="text-xs text-[var(--app-text-muted)] mt-1">{model.desc}</p>
                           </div>
                           {settings.defaultModel === model.id && <Check size={18} className="text-[var(--app-primary)] ml-auto self-center" />}
                        </button>
                      ))}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                 <div>
                   <h3 className="text-lg font-semibold mb-4">Backup & Restore</h3>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <button 
                        onClick={handleExportData}
                        className="p-4 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--app-text)] transition-colors hover:border-[var(--app-primary)]/50"
                      >
                         <ArrowUpCircle size={32} className="text-[var(--app-primary)]" />
                         <span className="font-semibold text-sm">Export Data</span>
                         <span className="text-[10px] text-[var(--app-text-muted)] text-center">Save settings, cart, and history to JSON</span>
                      </button>

                      <label className="p-4 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--app-text)] transition-colors hover:border-[var(--app-primary)]/50 cursor-pointer">
                         <ArrowDownCircle size={32} className="text-emerald-500" />
                         <span className="font-semibold text-sm">Import Data</span>
                         <span className="text-[10px] text-[var(--app-text-muted)] text-center">Restore from a JSON backup file</span>
                         <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                      </label>
                   </div>

                   <h3 className="text-lg font-semibold mb-4">Clear Data</h3>
                   <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50">
                         <div>
                            <p className="font-medium text-[var(--app-text)]">Clear Cart</p>
                            <p className="text-xs text-[var(--app-text-muted)]">Remove all packages from your selection.</p>
                         </div>
                         <button onClick={() => onClearData('cart')} className="px-4 py-2 bg-[var(--app-bg)] hover:bg-red-900/20 hover:text-red-400 text-[var(--app-text-muted)] rounded-lg text-sm font-medium transition-colors border border-[var(--app-border)] hover:border-red-900/50">
                            Clear Cart
                         </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50">
                         <div>
                            <p className="font-medium text-[var(--app-text)]">Clear Chat History</p>
                            <p className="text-xs text-[var(--app-text-muted)]">Delete all conversation history.</p>
                         </div>
                         <button onClick={() => onClearData('chat')} className="px-4 py-2 bg-[var(--app-bg)] hover:bg-red-900/20 hover:text-red-400 text-[var(--app-text-muted)] rounded-lg text-sm font-medium transition-colors border border-[var(--app-border)] hover:border-red-900/50">
                            Clear Chat
                         </button>
                      </div>

                      <div className="mt-8 pt-6 border-t border-[var(--app-border)]">
                         <button onClick={() => onClearData('all')} className="w-full py-3 bg-red-900/10 hover:bg-red-900/30 text-red-500 rounded-xl text-sm font-bold transition-colors border border-red-900/30 hover:border-red-500/50 flex items-center justify-center gap-2">
                            <Trash2 size={16} /> Reset Application Data
                         </button>
                         <p className="text-center text-xs text-[var(--app-text-muted)] mt-2">This will clear cart, history, and restore default settings.</p>
                      </div>
                   </div>
                 </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="flex flex-col items-center h-full text-center space-y-6 pt-4">
                 <div className="p-4 bg-[var(--app-bg)] rounded-2xl border border-[var(--app-border)] shadow-xl">
                   <Terminal size={48} className="text-[var(--app-primary)]" />
                 </div>
                 <div>
                   <h3 className="text-2xl font-bold mb-2">WinGet Web Interface</h3>
                   <p className="text-[var(--app-text-muted)] text-sm">Version 1.2.0</p>
                 </div>
                 <div className="max-w-xs text-sm text-[var(--app-text-muted)] leading-relaxed">
                   A modern, AI-powered interface for the Windows Package Manager. 
                   Generated scripts are processed locally or via Google Gemini API.
                 </div>
                 
                 <div className="w-full max-w-lg mt-6 text-left space-y-4">
                    <div className="p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50 space-y-3">
                       <h4 className="flex items-center gap-2 text-sm font-bold uppercase text-[var(--app-text)] border-b border-[var(--app-border)] pb-2">
                         <Construction size={14} /> Roadmap & Improvements
                       </h4>
                       <ul className="space-y-2">
                         <li className="flex items-start gap-2 text-xs text-[var(--app-text-muted)]">
                           <Bug size={12} className="text-amber-500 mt-0.5" />
                           <span><strong>Error Boundaries:</strong> Implement React Error Boundaries to prevent app crashes from rogue components.</span>
                         </li>
                         <li className="flex items-start gap-2 text-xs text-[var(--app-text-muted)]">
                           <Zap size={12} className="text-[var(--app-primary)] mt-0.5" />
                           <span><strong>Virtualization:</strong> Use virtual lists for rendering 100+ package cards to improve scroll performance.</span>
                         </li>
                         <li className="flex items-start gap-2 text-xs text-[var(--app-text-muted)]">
                           <MonitorSmartphone size={12} className="text-blue-400 mt-0.5" />
                           <span><strong>Mobile UX:</strong> Further refine touch targets and layout shifts for mobile devices.</span>
                         </li>
                         <li className="flex items-start gap-2 text-xs text-[var(--app-text-muted)]">
                           <Shield size={12} className="text-green-500 mt-0.5" />
                           <span><strong>Verification:</strong> Add more robust ID verification against official Microsoft repos to eliminate AI hallucinations.</span>
                         </li>
                       </ul>
                    </div>

                    <div className="p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50 space-y-2">
                        <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase mb-2">System Debug Info</p>
                        <div className="flex justify-between text-xs">
                           <span className="text-[var(--app-text-muted)]">Platform</span>
                           <span className="text-[var(--app-text)] font-mono">{navigator.platform}</span>
                        </div>
                         <div className="flex justify-between text-xs">
                           <span className="text-[var(--app-text-muted)]">User Agent</span>
                           <span className="text-[var(--app-text)] font-mono truncate max-w-[150px]" title={navigator.userAgent}>{navigator.userAgent}</span>
                        </div>
                         <div className="flex justify-between text-xs">
                           <span className="text-[var(--app-text-muted)]">Memory</span>
                           <span className="text-[var(--app-text)] font-mono">{(performance as any).memory ? Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024) + ' MB' : 'N/A'}</span>
                        </div>
                         <div className="flex justify-between text-xs">
                           <span className="text-[var(--app-text-muted)]">Cores</span>
                           <span className="text-[var(--app-text)] font-mono">{navigator.hardwareConcurrency || 'N/A'}</span>
                        </div>
                     </div>
                 </div>

                 <div className="flex gap-4 pt-4 pb-8">
                    <a href="#" className="p-2 bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors">
                      <Github size={20} />
                    </a>
                    <a href="#" className="p-2 bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors">
                      <Monitor size={20} />
                    </a>
                 </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [query, setQuery] = useState('');
  const [packages, setPackages] = useState<WingetPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
       const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
       if (saved) { 
          try { 
            const parsed = JSON.parse(saved);
            // Migrate old settings if needed
            if (!parsed.themes) parsed.themes = DEFAULT_THEMES;
            if (!parsed.activeThemeId) parsed.activeThemeId = 'default';
            if (typeof parsed.compactMode === 'undefined') parsed.compactMode = false;
            return parsed; 
          } catch(e){} 
       }
    }
    return { 
      reducedMotion: false, 
      highContrast: false, 
      compactMode: false,
      defaultModel: 'smart',
      activeThemeId: 'default',
      themes: DEFAULT_THEMES,
      customSubjects: ['Browsers', 'Communication', 'Dev Tools', 'Media Players'],
      itemsPerPage: 9
    };
  });

  // Apply Theme with CSS Variables
  useEffect(() => {
    const activeTheme = settings.themes.find(t => t.id === settings.activeThemeId) || DEFAULT_THEMES[0];
    const root = document.documentElement;
    
    // Inject CSS variables
    root.style.setProperty('--app-bg', activeTheme.colors.bg);
    root.style.setProperty('--app-surface', activeTheme.colors.surface);
    root.style.setProperty('--app-border', activeTheme.colors.border);
    root.style.setProperty('--app-text', activeTheme.colors.text);
    root.style.setProperty('--app-text-muted', activeTheme.colors.textMuted);
    root.style.setProperty('--app-primary', activeTheme.colors.primary);
    root.style.setProperty('--app-primary-hover', activeTheme.colors.primaryHover);

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    root.style.scrollBehavior = settings.reducedMotion ? 'auto' : 'smooth';
  }, [settings]);

  // Initialize Cart from LocalStorage
  const [cart, setCart] = useState<WingetPackage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse cart storage", e);
        }
      }
    }
    return [];
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<AppMode>('install');
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  
  // Chat Integration State
  const [chatResetKey, setChatResetKey] = useState(0);
  const [pendingChatQuery, setPendingChatQuery] = useState<string>('');

  const paletteInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Persist Cart Changes
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  // Reset state on mode change (but not cart)
  useEffect(() => {
    setPackages([]);
    setSearched(false);
    setCurrentPage(1);
    setQuery('');
    setImportText('');
    setImportError(null);
    setHasMore(true);
    abortControllerRef.current?.abort();
    setLoading(false);
    setLoadingMore(false);
  }, [mode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        if (isPaletteOpen) setIsPaletteOpen(false);
        if (isSettingsOpen) setIsSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaletteOpen, isSettingsOpen]);

  // Focus input when palette opens
  useEffect(() => {
    if (isPaletteOpen && paletteInputRef.current) {
      setTimeout(() => paletteInputRef.current?.focus(), 50);
    } else {
      setPaletteSearch('');
    }
  }, [isPaletteOpen]);

  const handleStopSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleClearData = (type: 'cart' | 'chat' | 'all') => {
    if (type === 'cart' || type === 'all') {
      setCart([]);
    }
    if (type === 'chat' || type === 'all') {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      setChatResetKey(prev => prev + 1);
    }
    if (type === 'all') {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      setSettings({ 
        reducedMotion: false, 
        highContrast: false, 
        compactMode: false,
        defaultModel: 'smart',
        activeThemeId: 'default',
        themes: DEFAULT_THEMES,
        customSubjects: ['Browsers', 'Communication', 'Dev Tools', 'Media Players'],
        itemsPerPage: 9
      });
      localStorage.removeItem('winget_drawer_prefs');
    }
  };

  const handleSearch = async (searchQuery: string) => {
    // If the searchQuery is empty (and not the special token), do nothing
    if (!searchQuery.trim() && searchQuery !== "POPULAR_ESSENTIALS") return;
    
    // Abort previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setSearched(true);
    setCurrentPage(1);
    setHasMore(true);
    
    // Explicitly handle state updates to prevent race conditions or confusing UI
    if (searchQuery === "POPULAR_ESSENTIALS") {
        setQuery(""); // Clear input to show "Recommended" title logic
    } else {
        setQuery(searchQuery);
    }
    
    try {
      const results = await searchPackages(searchQuery, [], ac.signal);
      setPackages(results);
      if (results.length < 12) setHasMore(false); // Heuristic: if initial batch is small, likely no more
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Aborted') {
         // Ignore aborted errors
         return;
      }
      console.error(error);
    } finally {
      // Only unset loading if this is the current active request (not aborted)
      if (!ac.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleLoadMore = async () => {
    if (!hasMore) return;

    // Abort previous request if any
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;
    
    // Abort logic for load more too if needed, though usually we append
    const activeQuery = query || "POPULAR_ESSENTIALS";
    setLoadingMore(true);
    
    try {
      // Exclude IDs already in the list to get new suggestions
      const currentIds = packages.map(p => p.id);
      const newResults = await searchPackages(activeQuery, currentIds, ac.signal);
      
      if (newResults && newResults.length > 0) {
        setPackages(prev => [...prev, ...newResults]);
        setCurrentPage(prev => prev + 1); // Automatically advance to the newly added page
        
        // If we received fewer results than a standard batch (usually 20-24), 
        // it means we've likely exhausted the AI's knowledge or search results.
        if (newResults.length < 6) {
           setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Aborted') {
          return;
      }
      console.error("Failed to load more packages", error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    
    setIsImporting(true);
    setImportError(null);
    
    // Simulate a small delay for UX feeling of processing
    setTimeout(() => {
      try {
        const parsed = parseWingetOutput(importText);
        
        if (parsed.length === 0) {
          setImportError("Could not identify any packages. Please ensure you are pasting the output from 'winget list' or 'winget upgrade'.");
          setPackages([]);
        } else {
          setPackages(parsed);
          setSearched(true);
          setImportText(''); // Clear text area after import
          setCurrentPage(1);
        }
      } catch (err) {
        console.error(err);
        setImportError("An unexpected error occurred while parsing the text.");
      } finally {
        setIsImporting(false);
      }
    }, 500);
  };

  const handleDeepScan = () => {
    setMode('upgrade');
    setPackages([]); // Resets to import view
    // Since packages is empty and mode is upgrade, renderContent will show the Import UI.
  };

  const toggleCart = (pkg: WingetPackage) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === pkg.id);
      if (exists) {
        return prev.filter(item => item.id !== pkg.id);
      }
      return [...prev, pkg];
    });
  };

  const copySingleCommand = (id: string, currentMode: AppMode) => {
    const cmd = currentMode === 'uninstall' 
      ? `winget uninstall ${id} -e`
      : `winget ${currentMode} ${id} -e`;
    navigator.clipboard.writeText(cmd);
  };
  
  const handleAskAI = (pkg: WingetPackage) => {
    const prompt = generateAppDetailsPrompt(pkg.name, pkg.id);
    setPendingChatQuery(prompt);
  };

  const handleFindAlternatives = (pkg: WingetPackage) => {
    setMode('install');
    const prompt = generateAlternativesPrompt(pkg.name);
    // Directly trigger search
    handleSearch(prompt);
  };

  const handleAnalyze = (pkg: WingetPackage) => {
    const prompt = generateEvaluationPrompt(pkg.name);
    setPendingChatQuery(prompt);
  };

  const getThemeColor = () => {
    switch (mode) {
      case 'upgrade': return 'from-emerald-600 to-teal-500';
      case 'uninstall': return 'from-red-600 to-rose-500';
      default: return 'from-[var(--app-primary)] to-cyan-500';
    }
  };

  // Callback for ChatInterface to show results
  const handleShowResults = (results: WingetPackage[]) => {
    setMode('install');
    setPackages(results);
    setSearched(true);
    setCurrentPage(1);
    setHasMore(false); // Chat results are usually fixed, disable "load more" contextually
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Commands for Palette
  const commands = [
    { 
      id: 'search', 
      label: 'Search Packages', 
      icon: <Search size={16} />, 
      action: () => { setMode('install'); const el = document.querySelector('input[placeholder*="Search packages"]') as HTMLInputElement; el?.focus(); } 
    },
    { 
      id: 'mode-install', 
      label: 'Switch to Install Mode', 
      icon: <Download size={16} />, 
      action: () => setMode('install') 
    },
    { 
      id: 'mode-upgrade', 
      label: 'Switch to Upgrade Mode', 
      icon: <RefreshCw size={16} />, 
      action: () => setMode('upgrade') 
    },
    { 
      id: 'mode-uninstall', 
      label: 'Switch to Uninstall Mode', 
      icon: <Trash2 size={16} />, 
      action: () => setMode('uninstall') 
    },
    { 
      id: 'toggle-drawer', 
      label: isDrawerOpen ? 'Close Script Drawer' : 'Open Script Drawer', 
      icon: <Terminal size={16} />, 
      action: () => setIsDrawerOpen(!isDrawerOpen) 
    },
    { 
      id: 'settings', 
      label: 'Open Settings', 
      icon: <Settings size={16} />, 
      action: () => setIsSettingsOpen(true) 
    },
    { 
      id: 'clear-cart', 
      label: 'Clear Current Cart', 
      icon: <X size={16} />, 
      action: () => { if(window.confirm('Clear cart?')) setCart([]); } 
    },
    {
      id: 'essentials',
      label: 'Load Essential Packages',
      icon: <Zap size={16} />,
      action: () => { setMode('install'); handleSearch("POPULAR_ESSENTIALS"); }
    }
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  const executeCommand = (action: () => void) => {
    action();
    setIsPaletteOpen(false);
  };

  // Pagination Logic
  const itemsPerPage = settings.itemsPerPage || 9;
  const totalPages = Math.ceil(packages.length / itemsPerPage);
  const paginatedPackages = packages.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderPagination = () => {
    if (totalPages <= 1 && !loadingMore && packages.length === 0) return null;

    return (
      <div className="flex flex-col items-center space-y-4 mt-8 py-4 border-t border-[var(--app-border)]/50">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1 || loadingMore}
            className={`p-2 rounded-lg transition-all flex items-center space-x-2 ${
              currentPage === 1 
                ? 'text-[var(--app-text-muted)] cursor-not-allowed' 
                : 'text-[var(--app-text)] hover:bg-[var(--app-surface)]'
            }`}
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-medium">Previous</span>
          </button>
          
          <span className="text-sm font-medium text-[var(--app-text-muted)]">
            Page <span className="text-[var(--app-text)]">{currentPage}</span> of <span className="text-[var(--app-text)]">{Math.max(1, totalPages)}</span>
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || loadingMore}
            className={`p-2 rounded-lg transition-all flex items-center space-x-2 ${
              currentPage === totalPages 
                ? 'text-[var(--app-text-muted)] cursor-not-allowed' 
                : 'text-[var(--app-text)] hover:bg-[var(--app-surface)]'
            }`}
          >
            <span className="text-sm font-medium">Next</span>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Load More Button - Only show if we are on the last page and it's a search result (not import) */}
        {currentPage === totalPages && searched && !isImporting && packages.length > 0 && mode === 'install' && (
           <div className="flex items-center gap-2">
             <button
               onClick={handleLoadMore}
               disabled={loadingMore || !hasMore}
               className={`flex items-center space-x-2 px-6 py-2 rounded-full transition-all border ${
                 !hasMore 
                   ? 'bg-[var(--app-bg)] text-[var(--app-text-muted)] border-[var(--app-border)] cursor-not-allowed'
                   : 'bg-[var(--app-surface)] hover:bg-[var(--app-border)] text-[var(--app-text)] border-[var(--app-border)]'
               }`}
             >
               {loadingMore ? <Loader2 size={16} className="animate-spin" /> : (!hasMore ? <Ban size={16} /> : <PlusCircle size={16} />)}
               <span className="text-sm font-medium">
                 {loadingMore ? 'Finding more...' : (!hasMore ? 'No more results' : 'Find More Results')}
               </span>
             </button>
             {loadingMore && (
                <button 
                  onClick={handleStopSearch}
                  className="p-2 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-full hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                  title="Stop Search"
                >
                  <XCircle size={18} />
                </button>
             )}
           </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    // 1. Loading State
    if (loading || isImporting) {
      return (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className={`animate-spin mb-4 ${
             mode === 'upgrade' ? 'text-emerald-500' : 
             mode === 'uninstall' ? 'text-red-500' : 
             'text-[var(--app-primary)]'
          }`} size={48} />
          <p className="text-[var(--app-text-muted)] animate-pulse">
            {isImporting ? 'Parsing installed packages...' : 'Querying package database...'}
          </p>
          {!isImporting && (
             <button 
               onClick={handleStopSearch}
               className="mt-6 px-4 py-2 bg-[var(--app-surface)] hover:bg-[var(--app-border)] text-[var(--app-text)] rounded-full text-xs font-medium transition-colors border border-[var(--app-border)] flex items-center gap-2"
             >
               <XCircle size={14} /> Stop Search
             </button>
          )}
        </div>
      );
    }

    // 2. Install Mode
    if (mode === 'install') {
      // 2a. Zero State / Dashboard
      if (!searched && packages.length === 0) {
        return (
          <div className="max-w-4xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center mb-12">
               <h1 className="text-4xl font-extrabold text-[var(--app-text)] tracking-tight mb-4">
                 WinGet Web Interface
               </h1>
               <p className="text-lg text-[var(--app-text-muted)] max-w-2xl mx-auto">
                 The modern way to explore, install, and manage Windows applications. 
                 Generate Powershell scripts instantly.
               </p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <button 
                  onClick={() => handleSearch("POPULAR_ESSENTIALS")}
                  className="group relative overflow-hidden p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-primary)]/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg"
                >
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Grid size={100} />
                   </div>
                   <div className="bg-[var(--app-primary)]/20 p-3 rounded-xl inline-flex text-[var(--app-primary)] mb-4 group-hover:scale-110 transition-transform">
                      <Zap size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Browse Essentials</h3>
                   <p className="text-sm text-[var(--app-text-muted)]">Discover popular tools for developers, gamers, and power users.</p>
                </button>

                <button 
                  onClick={() => setMode('upgrade')}
                  className="group relative overflow-hidden p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-emerald-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg"
                >
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Shield size={100} />
                   </div>
                   <div className="bg-emerald-900/30 p-3 rounded-xl inline-flex text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
                      <RefreshCw size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Check Upgrades</h3>
                   <p className="text-sm text-[var(--app-text-muted)]">Identify installed apps and generate an upgrade script.</p>
                </button>

                 <button 
                  onClick={() => setMode('uninstall')}
                  className="group relative overflow-hidden p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-red-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg"
                >
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                     <LayoutGrid size={100} />
                   </div>
                   <div className="bg-red-900/30 p-3 rounded-xl inline-flex text-red-400 mb-4 group-hover:scale-110 transition-transform">
                      <Trash2 size={32} />
                   </div>
                   <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Uninstall Apps</h3>
                   <p className="text-sm text-[var(--app-text-muted)]">Clean up bloatware and remove unused applications silently.</p>
                </button>
             </div>
             
             {/* Custom Subject Shortcuts */}
             <div className="max-w-3xl mx-auto text-center">
                <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider mb-4">Quick Search</p>
                <div className="flex flex-wrap justify-center gap-3">
                   {settings.customSubjects.map(subject => (
                      <button 
                        key={subject}
                        onClick={() => handleSearch(subject.toLowerCase())}
                        className="px-4 py-2 bg-[var(--app-surface)] hover:bg-[var(--app-border)] border border-[var(--app-border)]/50 rounded-full text-sm text-[var(--app-text)] transition-colors"
                      >
                         {subject}
                      </button>
                   ))}
                   <button 
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-3 py-2 text-[var(--app-text-muted)] hover:text-[var(--app-primary)] transition-colors border border-dashed border-[var(--app-border)] rounded-full flex items-center gap-1 text-sm"
                   >
                     <Plus size={14} /> Add
                   </button>
                </div>
             </div>
          </div>
        );
      }

      // 2b. Search Results
      return (
        <>
          <div className="flex flex-wrap gap-2 mb-8">
            <button 
               onClick={() => handleSearch("POPULAR_ESSENTIALS")}
               className="px-4 py-1.5 rounded-full text-xs font-medium border bg-[var(--app-primary)]/10 text-[var(--app-primary)] border-[var(--app-primary)]/30 hover:bg-[var(--app-primary)]/20 transition-colors"
            >
              Essentials
            </button>
            {PRESET_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => handleSearch(cat.toLowerCase())}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)] hover:bg-[var(--app-border)] hover:text-[var(--app-text)] transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[var(--app-text)] flex items-center gap-2">
              {searched ? (query && query !== "POPULAR_ESSENTIALS" ? `Results for "${query}"` : 'Recommended') : 'Popular Packages'}
            </h2>
            {packages.length > 0 && (
               <span className="text-sm text-[var(--app-text-muted)] hidden sm:inline-block">Found {packages.length} packages</span>
            )}
          </div>

          {packages.length === 0 && searched && (
            <div className="flex flex-col items-center justify-center h-64 text-[var(--app-text-muted)] bg-[var(--app-surface)]/50 rounded-2xl border border-[var(--app-border)]">
              <Package size={48} className="mb-4 opacity-20" />
              <p className="text-lg">No packages found.</p>
              <p className="text-sm">Try a different search term.</p>
            </div>
          )}

          {packages.length > 0 && (
            <>
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${settings.compactMode ? 'gap-3' : 'gap-6'}`}>
                {paginatedPackages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    isInCart={!!cart.find(c => c.id === pkg.id)}
                    onToggleCart={toggleCart}
                    onCopyCommand={copySingleCommand}
                    onAskAI={handleAskAI}
                    onFindAlternatives={handleFindAlternatives}
                    onAnalyze={handleAnalyze}
                    mode={mode}
                    compactMode={settings.compactMode}
                  />
                ))}
              </div>
              {renderPagination()}
              <div className="h-20"></div> {/* Spacer for bottom scrolling */}
            </>
          )}
        </>
      );
    }

    // 3. Upgrade / Uninstall Mode: Import Workflow
    const isMaintenanceMode = mode === 'upgrade' || mode === 'uninstall';
    
    if (isMaintenanceMode && packages.length === 0) {
      return (
        <div className="max-w-3xl mx-auto mt-8">
          <div className={`rounded-2xl border p-8 bg-[var(--app-surface)]/50 ${
            mode === 'upgrade' ? 'border-emerald-900/50' : 'border-red-900/50'
          }`}>
            <div className="text-center mb-8">
              <div className={`inline-flex p-4 rounded-full mb-4 bg-opacity-10 ${
                mode === 'upgrade' ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500'
              }`}>
                {mode === 'upgrade' ? <RefreshCw size={48} /> : <Trash2 size={48} />}
              </div>
              <h2 className="text-2xl font-bold text-[var(--app-text)] mb-2">
                {mode === 'upgrade' ? 'Check for Upgrades' : 'Bulk Uninstall'}
              </h2>
              <p className="text-[var(--app-text-muted)]">
                Since we run in the browser, we need you to tell us what's installed on your PC.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-[var(--app-bg)] p-4 rounded-lg border border-[var(--app-border)]">
                  <span className="font-bold text-[var(--app-text)] block mb-1">Step 1</span>
                  <span className="text-[var(--app-text-muted)]">Open PowerShell or Command Prompt.</span>
                </div>
                <div className="bg-[var(--app-bg)] p-4 rounded-lg border border-[var(--app-border)]">
                  <span className="font-bold text-[var(--app-text)] block mb-1">Step 2</span>
                  <span className="text-[var(--app-text-muted)]">Run <code className="bg-[var(--app-surface)] px-1 py-0.5 rounded text-[var(--app-primary)]">winget {mode === 'upgrade' ? 'upgrade' : 'list'}</code></span>
                  {mode === 'upgrade' && (
                    <div className="mt-2 text-xs text-emerald-400 bg-emerald-950/30 p-2 rounded border border-emerald-900/30">
                      <strong>Tip:</strong> Run <code className="text-white">winget list --source winget</code> for the most accurate list of upgrades.
                    </div>
                  )}
                </div>
                <div className="bg-[var(--app-bg)] p-4 rounded-lg border border-[var(--app-border)]">
                  <span className="font-bold text-[var(--app-text)] block mb-1">Step 3</span>
                  <span className="text-[var(--app-text-muted)]">Copy the output and paste it below.</span>
                </div>
              </div>

              {importError && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-300 text-sm flex items-center gap-3">
                   <InfoIcon size={20} className="flex-shrink-0" />
                   <p>{importError}</p>
                </div>
              )}

              <div className="relative">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={mode === 'upgrade' 
                    ? `Name             Id               Version      Available    Source\n--------------------------------------------------------------\nPowerToys        Microsoft.PowerToys 0.60.0       0.61.0       winget`
                    : `Name             Id               Version\n------------------------------------------------\nMozilla Firefox  Mozilla.Firefox  120.0...`}
                  className={`w-full h-48 bg-[var(--app-bg)] border rounded-xl p-4 font-mono text-xs focus:ring-2 focus:outline-none transition-all text-[var(--app-text)] ${
                     mode === 'upgrade' ? 'border-emerald-900/30 focus:border-emerald-500 focus:ring-emerald-900/20' : 
                     'border-red-900/30 focus:border-red-500 focus:ring-red-900/20'
                  }`}
                />
                <div className="absolute top-4 right-4 text-[var(--app-text-muted)] pointer-events-none">
                  <ClipboardPaste size={20} />
                </div>
              </div>

              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  !importText.trim() 
                    ? 'bg-[var(--app-border)] text-[var(--app-text-muted)] cursor-not-allowed' 
                    : mode === 'upgrade' 
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' 
                      : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                }`}
              >
                <span>Parse Installed Packages</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 4. Upgrade / Uninstall Mode: Results Grid
    if (isMaintenanceMode && packages.length > 0) {
      return (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[var(--app-text)] flex items-center gap-2">
              Detected Software
              <span className="px-3 py-1 bg-[var(--app-surface)] text-[var(--app-text-muted)] text-sm rounded-full font-normal">
                {packages.length} items
              </span>
            </h2>
            <button 
              onClick={() => { setPackages([]); setImportText(''); setCurrentPage(1); setImportError(null); }} 
              className="text-sm text-[var(--app-text-muted)] hover:text-[var(--app-text)] underline decoration-[var(--app-border)]"
            >
              Parse new list
            </button>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${settings.compactMode ? 'gap-3' : 'gap-6'}`}>
            {paginatedPackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                isInCart={!!cart.find(c => c.id === pkg.id)}
                onToggleCart={toggleCart}
                onCopyCommand={copySingleCommand}
                onAskAI={handleAskAI}
                onFindAlternatives={handleFindAlternatives}
                onAnalyze={handleAnalyze}
                mode={mode}
                compactMode={settings.compactMode}
              />
            ))}
          </div>
          {renderPagination()}
          <div className="h-20"></div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col font-sans relative transition-colors duration-300">
      
      {/* Command Palette Modal */}
      {isPaletteOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]" onClick={() => setIsPaletteOpen(false)}>
          <div 
            className="w-full max-w-xl bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center px-4 py-3 border-b border-[var(--app-border)]">
              <Command size={18} className="text-[var(--app-text-muted)] mr-3" />
              <input
                ref={paletteInputRef}
                type="text"
                placeholder="Type a command..."
                className="flex-1 bg-transparent border-none focus:outline-none text-[var(--app-text)] placeholder-[var(--app-text-muted)]"
                value={paletteSearch}
                onChange={e => setPaletteSearch(e.target.value)}
              />
              <span className="text-xs text-[var(--app-text-muted)] border border-[var(--app-border)] px-1.5 rounded">ESC</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto py-2">
              <div className="px-3 py-1 text-xs font-semibold text-[var(--app-text-muted)] uppercase">Suggestions</div>
              {filteredCommands.length > 0 ? (
                filteredCommands.map(cmd => (
                  <CommandItem 
                    key={cmd.id}
                    icon={cmd.icon}
                    label={cmd.label}
                    onClick={() => executeCommand(cmd.action)}
                  />
                ))
              ) : (
                 <div className="px-4 py-3 text-[var(--app-text-muted)] text-sm">No commands found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings}
        onUpdateSettings={setSettings}
        onClearData={handleClearData}
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-[var(--app-surface)]/80 backdrop-blur-md border-b border-[var(--app-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setMode('install'); setSearched(false); setPackages([]); setQuery(''); }}>
              <div className={`bg-gradient-to-r ${getThemeColor()} p-2 rounded-lg transition-all duration-500`}>
                <Terminal size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--app-text)] to-[var(--app-text-muted)]">
                WinGet Web
              </span>
            </div>

            {/* Desktop Search (Only in Install Mode) */}
            {mode === 'install' && (
              <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
                <input
                  type="text"
                  value={query === "POPULAR_ESSENTIALS" ? "" : query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                  placeholder="Search packages (e.g. 'vscode', 'python')..."
                  className="w-full bg-[var(--app-bg)] border border-[var(--app-border)] rounded-full py-2 pl-12 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent placeholder-[var(--app-text-muted)] text-[var(--app-text)] transition-all"
                />
                <Search className="absolute left-4 top-2.5 text-[var(--app-text-muted)]" size={18} />
                {loading ? (
                   <button 
                     onClick={handleStopSearch}
                     className="absolute right-3 top-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                     title="Stop Search"
                   >
                     <XCircle size={16} />
                   </button>
                ) : (
                  query && query !== "POPULAR_ESSENTIALS" && (
                    <button 
                     onClick={() => { setQuery(''); if(abortControllerRef.current) abortControllerRef.current.abort(); }}
                     className="absolute right-3 top-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                     title="Clear Search"
                   >
                     <X size={16} />
                   </button>
                  )
                )}
              </div>
            )}
             {mode !== 'install' && <div className="flex-1" />}

            {/* Actions */}
            <div className="flex items-center space-x-4">
               {/* Settings Button */}
               <button 
                 onClick={() => setIsSettingsOpen(true)}
                 className="hidden md:flex items-center justify-center p-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface)] rounded-full transition-colors"
                 title="Settings"
              >
                <Settings size={20} />
              </button>

              <button 
                 onClick={() => setIsPaletteOpen(true)}
                 className="hidden md:flex items-center space-x-1 text-xs font-mono text-[var(--app-text-muted)] border border-[var(--app-border)] rounded px-2 py-1 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] transition-colors"
                 title="Command Palette"
              >
                <span>CTRL</span><span>K</span>
              </button>
              <Tooltip content={`View Cart (${cart.length} items)`}>
                <button 
                  onClick={() => setIsDrawerOpen(true)}
                  className="relative p-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface)] rounded-full"
                >
                  <ShoppingBag size={24} />
                  {cart.length > 0 && (
                    <span className={`absolute top-0 right-0 h-5 w-5 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[var(--app-bg)] ${
                      mode === 'upgrade' ? 'bg-emerald-600' : 
                      mode === 'uninstall' ? 'bg-red-600' : 
                      'bg-[var(--app-primary)]'
                    }`}>
                      {cart.length}
                    </span>
                  )}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </nav>

      {/* Mode Switcher Banner */}
      <div className="bg-[var(--app-surface)] border-b border-[var(--app-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
           <div className="flex justify-center sm:justify-start space-x-1">
              <Tooltip content="Search for and generate scripts to install new packages">
                <button 
                  onClick={() => setMode('install')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === 'install' 
                    ? 'bg-[var(--app-primary)] text-white shadow-lg shadow-blue-900/20' 
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg)]'
                  }`}
                >
                  <Download size={16} />
                  <span>Install</span>
                </button>
              </Tooltip>
              
              <Tooltip content="Generate scripts to update your existing applications">
                <button 
                  onClick={() => setMode('upgrade')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === 'upgrade' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg)]'
                  }`}
                >
                  <RefreshCw size={16} />
                  <span>Upgrade</span>
                </button>
              </Tooltip>

              <Tooltip content="Generate scripts to remove applications from your system">
                <button 
                  onClick={() => setMode('uninstall')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    mode === 'uninstall' 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' 
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg)]'
                  }`}
                >
                  <Trash2 size={16} />
                  <span>Uninstall</span>
                </button>
              </Tooltip>
           </div>
        </div>
      </div>

      {/* Mobile Search Bar (Only in Install Mode) */}
      {mode === 'install' && (
        <div className="md:hidden p-4 border-b border-[var(--app-border)] bg-[var(--app-surface)]/50">
          <div className="relative">
            <input
              type="text"
              value={query === "POPULAR_ESSENTIALS" ? "" : query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              placeholder="Search packages..."
              className="w-full bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)] text-[var(--app-text)]"
            />
            <Search className="absolute left-3 top-3.5 text-[var(--app-text-muted)]" size={18} />
             {loading ? (
                 <button 
                   onClick={handleStopSearch}
                   className="absolute right-3 top-3 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                 >
                   <XCircle size={18} />
                 </button>
             ) : (
                query && query !== "POPULAR_ESSENTIALS" && (
                   <button 
                     onClick={() => setQuery('')}
                     className="absolute right-3 top-3 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                   >
                     <X size={18} />
                   </button>
                )
             )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>

      {/* Script Drawer */}
      <ScriptDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)}
        cart={cart}
        onRemove={(id) => setCart(prev => prev.filter(p => p.id !== id))}
        onClear={() => setCart([])}
        mode={mode}
        onSwitchToUpgrade={() => setMode('upgrade')}
        onDeepScan={handleDeepScan}
      />

      {/* AI Chat Bot */}
      <ChatInterface 
         key={chatResetKey} 
         onShowResults={handleShowResults}
         pendingMessage={pendingChatQuery}
         onClearPendingMessage={() => setPendingChatQuery('')}
         defaultModel={settings.defaultModel}
      />

    </div>
  );
}

export default App;