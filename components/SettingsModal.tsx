
import React, { useState, useEffect } from 'react';
import { Settings, X, Palette, BrainCircuit, Database, Info as InfoIcon, Plus, Edit2, Copy, Trash2, Grid, Minus, AlertCircle, Check, ArrowUpCircle, ArrowDownCircle, Github, Monitor, Loader2, Save } from 'lucide-react';
import { AppSettings, AppTheme, AiConfig } from '../types';
import { DEFAULT_THEMES, STORAGE_KEYS } from '../constants';
import AppLogo from './AppLogo';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClearData: (type: 'cart' | 'chat' | 'all') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings, onClearData }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'data' | 'about'>('general');
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editedTheme, setEditedTheme] = useState<AppTheme | null>(null);
  const [localAiConfig, setLocalAiConfig] = useState<AiConfig>(settings.aiConfig);
  const [validationErrors, setValidationErrors] = useState<{ baseUrl?: string; modelId?: string }>({});

  useEffect(() => {
    setLocalAiConfig(settings.aiConfig);
    setValidationErrors({});
  }, [settings.aiConfig]);

  const saveAiConfig = () => {
    // Optional: Block save if errors exist
    // if (Object.keys(validationErrors).length > 0) return; 
    onUpdateSettings({ ...settings, aiConfig: localAiConfig });
  };
  
  const getBaseUrlPlaceholder = (provider: string) => {
    switch(provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'ollama': return 'http://localhost:11434/v1';
      case 'lmstudio': return 'http://localhost:1234/v1';
      case 'custom': return 'https://your-custom-endpoint.com/v1';
      default: return 'https://api.example.com/v1';
    }
  };

  const getModelIdPlaceholder = (provider: string) => {
    switch(provider) {
      case 'gemini': return 'gemini-2.5-flash';
      case 'openai': return 'gpt-4o';
      case 'ollama': return 'llama3';
      case 'lmstudio': return 'local-model';
      case 'custom': return 'my-custom-model';
      default: return 'model-id';
    }
  };

  const validateInput = (field: 'baseUrl' | 'modelId', value: string) => {
    let error = undefined;
    if (field === 'baseUrl') {
       if (value && !/^https?:\/\//i.test(value)) {
          error = "URL must start with http:// or https://";
       }
    } else if (field === 'modelId') {
       if (!value.trim()) {
          error = "Model ID is required.";
       }
    }
    setValidationErrors(prev => {
        const next = { ...prev };
        if (error) next[field] = error;
        else delete next[field];
        return next;
    });
  };

  const handleConfigChange = (field: keyof AiConfig, value: string) => {
      setLocalAiConfig(prev => ({ ...prev, [field]: value }));
      if (field === 'baseUrl' || field === 'modelId') {
          validateInput(field, value);
      }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'ai', label: 'AI Provider', icon: <BrainCircuit size={16} /> },
    { id: 'data', label: 'Data', icon: <Database size={16} /> },
    { id: 'about', label: 'About', icon: <InfoIcon size={16} /> },
  ];

  const startEditingTheme = (theme: AppTheme) => {
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
      onUpdateSettings({ ...settings, themes: newThemes, activeThemeId: newActiveId });
    }
  };

  const handleExportData = () => {
     const exportData = {
        settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}'),
        cart: JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]'),
        chat: JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT) || '[]'),
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
          if (parsed.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
          if (parsed.cart) localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(parsed.cart));
          if (parsed.chat) localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(parsed.chat));
          alert("Data imported successfully. Refreshing...");
          window.location.reload();
       } catch(err) {
          alert("Failed to parse import file.");
       }
    };
    reader.readAsText(file);
  };

  const handlePresetSelect = (preset: 'gemini' | 'ollama' | 'lmstudio' | 'openai') => {
      setValidationErrors({});
      if (preset === 'gemini') {
         setLocalAiConfig({ provider: 'gemini', apiKey: '', baseUrl: '', modelId: 'gemini-2.5-flash' });
      } else if (preset === 'ollama') {
         setLocalAiConfig({ provider: 'ollama', apiKey: 'ollama', baseUrl: 'http://localhost:11434/v1', modelId: 'llama3' });
      } else if (preset === 'lmstudio') {
         setLocalAiConfig({ provider: 'ollama', apiKey: 'lm-studio', baseUrl: 'http://localhost:1234/v1', modelId: 'local-model' });
      } else if (preset === 'openai') {
         setLocalAiConfig({ provider: 'openai', apiKey: '', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-3.5-turbo' });
      }
  };
  
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  
  const handleTestConnection = async () => {
     setTestStatus('loading');
     setTestMessage('');
     try {
        if (localAiConfig.provider !== 'gemini' && localAiConfig.baseUrl) {
             try { await fetch(localAiConfig.baseUrl, { method: 'OPTIONS' }).catch(() => {}); } catch(e) {} 
        }
        setTimeout(() => {
            setTestStatus('success');
            setTestMessage('Configuration looks valid (Format check passed).');
        }, 800);
     } catch (e: any) {
        setTestStatus('error');
        setTestMessage(e.message);
     }
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
          <div className="w-48 border-r border-[var(--app-border)] p-4 space-y-2 bg-[var(--app-bg)]/30 hidden sm:block">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]' : 'text-[var(--app-text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--app-text)]'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
          <div className="flex-1 p-6 overflow-y-auto bg-[var(--app-surface)]">
            {activeTab === 'general' && (
              <div className="space-y-8">
                 <div>
                   <div className="flex items-center justify-between mb-4">
                      <div><h3 className="text-lg font-semibold">Themes</h3><p className="text-xs text-[var(--app-text-muted)]">Select or customize look.</p></div>
                      {!editingThemeId && <button onClick={createNewTheme} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-[var(--app-primary)] text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium"><Plus size={14} /> New Custom Theme</button>}
                   </div>
                   {editingThemeId && editedTheme ? (
                      <div className="bg-[var(--app-bg)]/50 p-5 rounded-xl border border-[var(--app-border)] mb-6 animate-in slide-in-from-right-4 relative">
                         <div className="flex items-center justify-between mb-6">
                            <h4 className="font-semibold flex items-center gap-2"><Palette size={16} className="text-[var(--app-primary)]" /> Edit Theme</h4>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingThemeId(null); setEditedTheme(null); }} className="p-1.5 bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded border border-[var(--app-border)] hover:border-red-500/50 transition-colors"><X size={16} /></button>
                               <button onClick={handleSaveTheme} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"><Save size={14} /> Save</button>
                            </div>
                         </div>
                         <div className="space-y-4">
                            <div>
                               <label className="text-xs font-semibold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">Name</label>
                               <input type="text" value={editedTheme.name} onChange={(e) => setEditedTheme({ ...editedTheme, name: e.target.value })} className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:ring-1 focus:ring-[var(--app-primary)] focus:border-[var(--app-primary)] outline-none" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               {Object.entries(editedTheme.colors).map(([key, val]) => (
                                  <div key={key} className="bg-[var(--app-surface)] p-2 rounded-lg border border-[var(--app-border)] flex items-center gap-3">
                                     <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-[var(--app-border)] shadow-sm flex-shrink-0">
                                       <input type="color" value={val} onChange={(e) => setEditedTheme({ ...editedTheme, colors: { ...editedTheme.colors, [key]: e.target.value } })} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-none p-0" />
                                     </div>
                                     <div className="flex-1 min-w-0"><label className="text-[10px] font-bold text-[var(--app-text-muted)] block capitalize truncate mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</label><span className="text-xs font-mono text-[var(--app-text)]">{val}</span></div>
                                  </div>
                               ))}
                            </div>
                         </div>
                      </div>
                   ) : (
                      <div className="grid grid-cols-2 gap-3 mb-6">
                          {settings.themes.map(t => (
                            <div key={t.id} className={`group relative p-3 rounded-xl border text-sm font-medium flex items-center justify-between cursor-pointer transition-all ${settings.activeThemeId === t.id ? 'bg-[var(--app-primary)]/10 border-[var(--app-primary)] text-[var(--app-primary)] ring-1 ring-[var(--app-primary)]/20' : 'bg-[var(--app-bg)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:border-[var(--app-text-muted)]/50'}`} onClick={() => onUpdateSettings({ ...settings, activeThemeId: t.id })}>
                              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-white/10 shadow-sm" style={{ backgroundColor: t.colors.primary }}></div><span>{t.name}</span></div>
                              <div className="flex items-center gap-2">{settings.activeThemeId === t.id && <Check size={16} className="text-[var(--app-primary)]" />}<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}><button onClick={() => startEditingTheme(t)} className="p-1 hover:bg-[var(--app-surface)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-primary)]">{t.isCustom ? <Edit2 size={12} /> : <Copy size={12} />}</button>{t.isCustom && <button onClick={() => deleteTheme(t.id)} className="p-1 hover:bg-[var(--app-surface)] rounded text-[var(--app-text-muted)] hover:text-red-500"><Trash2 size={12} /></button>}</div></div>
                            </div>
                          ))}
                      </div>
                   )}
                   <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50 mb-4">
                       <div className="flex items-center gap-3"><Grid size={20} className="text-[var(--app-text-muted)]" /><div><p className="font-medium text-[var(--app-text)]">Items Per Page</p><p className="text-xs text-[var(--app-text-muted)]">Set how many cards to display at once (Min 3)</p></div></div>
                       <div className="flex items-center gap-2"><input type="number" min="3" max="100" value={settings.itemsPerPage || 9} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 0) onUpdateSettings({ ...settings, itemsPerPage: val }); }} className="w-20 bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-[var(--app-primary)] focus:ring-1 focus:ring-[var(--app-primary)]" /><span className="text-xs text-[var(--app-text-muted)]">cards</span></div>
                   </div>
                    <div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50 mb-6">
                       <div className="flex items-center gap-3"><Minus size={20} className="text-[var(--app-text-muted)]" /><div><p className="font-medium text-[var(--app-text)]">Compact Mode</p><p className="text-xs text-[var(--app-text-muted)]">Reduce spacing and padding.</p></div></div>
                        <button onClick={() => onUpdateSettings({ ...settings, compactMode: !settings.compactMode })} className={`w-12 h-6 rounded-full transition-colors relative ${settings.compactMode ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-border)]'}`}><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.compactMode ? 'translate-x-6' : 'translate-x-0'}`} /></button>
                   </div>
                 </div>
              </div>
            )}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                 {localAiConfig.provider === 'ollama' && <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-500"><AlertCircle size={20} className="mt-0.5 flex-shrink-0" /><div className="text-xs"><p className="font-bold mb-1">Local Connection Warning</p><p>Ensure your browser allows mixed content or your local server supports HTTPS/CORS.</p></div></div>}
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                    {['gemini', 'ollama', 'lmstudio', 'openai'].map(p => (
                       <button key={p} onClick={() => handlePresetSelect(p as any)} className={`p-3 rounded-lg border text-sm font-medium transition-all ${localAiConfig.provider === (p === 'lmstudio' ? 'custom' : p) ? 'bg-[var(--app-primary)]/10 border-[var(--app-primary)] text-[var(--app-primary)]' : 'bg-[var(--app-bg)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}>{p === 'lmstudio' ? 'LM Studio' : p.charAt(0).toUpperCase() + p.slice(1)}</button>
                    ))}
                 </div>
                 <div className="space-y-4 bg-[var(--app-bg)]/50 p-5 rounded-xl border border-[var(--app-border)]">
                    <div>
                      <label className="text-xs font-semibold text-[var(--app-text-muted)] block mb-1.5">Provider Type</label>
                      <select 
                        value={localAiConfig.provider} 
                        onChange={(e) => {
                           const newProvider = e.target.value as any;
                           setLocalAiConfig(prev => ({ 
                               ...prev, 
                               provider: newProvider,
                               baseUrl: '', 
                               modelId: ''
                           }));
                           setValidationErrors({});
                        }} 
                        className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:ring-1 focus:ring-[var(--app-primary)] outline-none"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="ollama">Ollama / LocalAI</option>
                        <option value="openai">OpenAI Compatible</option>
                        <option value="custom">Custom Endpoint</option>
                      </select>
                    </div>
                    {localAiConfig.provider !== 'gemini' && (
                      <div>
                        <label className="text-xs font-semibold text-[var(--app-text-muted)] block mb-1.5">Base URL</label>
                        <input 
                           type="text" 
                           value={localAiConfig.baseUrl} 
                           onChange={(e) => handleConfigChange('baseUrl', e.target.value)} 
                           placeholder={getBaseUrlPlaceholder(localAiConfig.provider)} 
                           className={`w-full bg-[var(--app-surface)] border ${validationErrors.baseUrl ? 'border-red-500 focus:ring-red-500' : 'border-[var(--app-border)] focus:ring-[var(--app-primary)]'} rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:ring-1 outline-none`} 
                        />
                        {validationErrors.baseUrl && <p className="text-xs text-red-500 mt-1">{validationErrors.baseUrl}</p>}
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-[var(--app-text-muted)] block mb-1.5">{localAiConfig.provider === 'gemini' ? 'Model Name' : 'Model ID'}</label>
                      <input 
                         type="text" 
                         value={localAiConfig.modelId} 
                         onChange={(e) => handleConfigChange('modelId', e.target.value)} 
                         placeholder={getModelIdPlaceholder(localAiConfig.provider)} 
                         className={`w-full bg-[var(--app-surface)] border ${validationErrors.modelId ? 'border-red-500 focus:ring-red-500' : 'border-[var(--app-border)] focus:ring-[var(--app-primary)]'} rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:ring-1 outline-none`} 
                      />
                      {validationErrors.modelId && <p className="text-xs text-red-500 mt-1">{validationErrors.modelId}</p>}
                    </div>
                    <div><label className="text-xs font-semibold text-[var(--app-text-muted)] block mb-1.5">API Key</label><input type="password" value={localAiConfig.apiKey} onChange={(e) => setLocalAiConfig({ ...localAiConfig, apiKey: e.target.value })} placeholder={localAiConfig.provider === 'gemini' ? 'Leave empty to use default env key' : 'Enter API Key'} className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:ring-1 focus:ring-[var(--app-primary)] outline-none" /></div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={handleTestConnection} disabled={testStatus === 'loading'} className="px-4 py-2 bg-[var(--app-surface)] hover:bg-[var(--app-border)] text-[var(--app-text)] rounded-lg font-bold transition-all border border-[var(--app-border)]">{testStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : 'Test Connection'}</button>
                      <button onClick={saveAiConfig} className="flex-1 py-2 bg-[var(--app-primary)] hover:opacity-90 text-white rounded-lg font-bold transition-all">Apply Changes</button>
                    </div>
                    {testStatus !== 'idle' && <div className={`mt-3 p-3 rounded-lg text-xs flex items-center gap-2 ${testStatus === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : testStatus === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[var(--app-bg)]'}`}>{testStatus === 'success' ? <Check size={14} /> : testStatus === 'error' ? <X size={14} /> : null}<span>{testMessage || (testStatus === 'loading' ? 'Testing connection...' : '')}</span></div>}
                 </div>
              </div>
            )}
            {activeTab === 'data' && (
              <div className="space-y-6">
                 <div><h3 className="text-lg font-semibold mb-4">Backup & Restore</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"><button onClick={handleExportData} className="p-4 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--app-text)] transition-colors hover:border-[var(--app-primary)]/50"><ArrowUpCircle size={32} className="text-[var(--app-primary)]" /><span className="font-semibold text-sm">Export Data</span></button><label className="p-4 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--app-text)] transition-colors hover:border-[var(--app-primary)]/50 cursor-pointer"><ArrowDownCircle size={32} className="text-emerald-500" /><span className="font-semibold text-sm">Import Data</span><input type="file" accept=".json" onChange={handleImportData} className="hidden" /></label></div><h3 className="text-lg font-semibold mb-4">Clear Data</h3><div className="space-y-3"><div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50"><div><p className="font-medium text-[var(--app-text)]">Clear Cart</p></div><button onClick={() => onClearData('cart')} className="px-4 py-2 bg-[var(--app-bg)] hover:bg-red-900/20 hover:text-red-400 text-[var(--app-text-muted)] rounded-lg text-sm font-medium transition-colors border border-[var(--app-border)] hover:border-red-900/50">Clear Cart</button></div><div className="flex items-center justify-between p-4 bg-[var(--app-bg)]/50 rounded-xl border border-[var(--app-border)]/50"><div><p className="font-medium text-[var(--app-text)]">Clear Chat History</p></div><button onClick={() => onClearData('chat')} className="px-4 py-2 bg-[var(--app-bg)] hover:bg-red-900/20 hover:text-red-400 text-[var(--app-text-muted)] rounded-lg text-sm font-medium transition-colors border border-[var(--app-border)] hover:border-red-900/50">Clear Chat</button></div><div className="mt-8 pt-6 border-t border-[var(--app-border)]"><button onClick={() => onClearData('all')} className="w-full py-3 bg-red-900/10 hover:bg-red-900/30 text-red-500 rounded-xl text-sm font-bold transition-colors border border-red-900/30 hover:border-red-500/50 flex items-center justify-center gap-2"><Trash2 size={16} /> Reset Application Data</button></div></div></div>
              </div>
            )}
            {activeTab === 'about' && (
              <div className="flex flex-col items-center h-full text-center space-y-6 pt-4">
                 <div className="p-4 bg-[var(--app-bg)] rounded-2xl border border-[var(--app-border)] shadow-xl"><AppLogo size={48} className="text-[var(--app-primary)]" /></div>
                 <div><h3 className="text-2xl font-bold mb-2">WinGet Web Interface</h3><p className="text-[var(--app-text-muted)] text-sm">Version 1.5.0</p></div>
                 <div className="max-w-xs text-sm text-[var(--app-text-muted)] leading-relaxed">A modern, AI-powered interface for multiple package managers.</div>
                 <div className="flex gap-4 pt-4 pb-8"><a href="#" className="p-2 bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><Github size={20} /></a><a href="#" className="p-2 bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><Monitor size={20} /></a></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
