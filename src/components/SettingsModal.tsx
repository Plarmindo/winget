
import React, { useState } from 'react';
import { Palette, BrainCircuit, Database, Info as InfoIcon, X, Link } from 'lucide-react';
import AppLogo from './AppLogo';
import { useAppStore } from '../stores/store';
import { AppearanceTab } from './settings/AppearanceTab';
import { AiTab } from './settings/AiTab';
import { DataTab } from './settings/DataTab';
import { AboutTab } from './settings/AboutTab';
import { ConnectionsTab } from './settings/ConnectionsTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearData: (type: 'cart' | 'chat' | 'all') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onClearData }) => {
  const { settings, updateSettings } = useAppStore();
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'connections' | 'data' | 'about'>('general');

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'Appearance', icon: <Palette size={18} />, desc: 'Themes & Layout' },
    { id: 'ai', label: 'Intelligence', icon: <BrainCircuit size={18} />, desc: 'Models & API' },
    { id: 'connections', label: 'Connections', icon: <Link size={18} />, desc: 'GitHub & Integrations' },
    { id: 'data', label: 'Data', icon: <Database size={18} />, desc: 'Backup & Reset' },
    { id: 'about', label: 'About', icon: <InfoIcon size={18} />, desc: 'Version Info' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col md:flex-row text-[var(--app-text)] relative" 
        onClick={e => e.stopPropagation()}
      >
        <div className="md:w-64 bg-[var(--app-bg)] border-r border-[var(--app-border)] flex flex-col">
            <div className="p-6 border-b border-[var(--app-border)] flex items-center gap-3">
               <AppLogo size={24} className="text-[var(--app-primary)]" />
               <span className="font-bold text-lg tracking-tight">Settings</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                            activeTab === tab.id ? 'bg-[var(--app-primary)] text-white shadow-lg' : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]'
                        }`}
                    >
                        {tab.icon}
                        <div><div className="font-semibold text-sm">{tab.label}</div><div className={`text-[10px] opacity-70`}>{tab.desc}</div></div>
                    </button>
                ))}
            </div>
            <div className="p-4 border-t border-[var(--app-border)]">
                <button onClick={onClose} className="w-full py-2 px-4 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-surface)] text-sm font-medium transition-colors">Close</button>
            </div>
        </div>
        <div className="flex-1 flex flex-col bg-[var(--app-surface)] overflow-hidden relative p-6 md:p-8 overflow-y-auto">
             {activeTab === 'general' && <AppearanceTab settings={settings} onUpdateSettings={updateSettings} />}
             {activeTab === 'ai' && <AiTab settings={settings} onUpdateSettings={updateSettings} />}
             {activeTab === 'connections' && <ConnectionsTab settings={settings} onUpdateSettings={updateSettings} />}
             {activeTab === 'data' && <DataTab onClearData={onClearData} />}
             {activeTab === 'about' && <AboutTab />}
        </div>
      </div>
    </div>
  );
};
