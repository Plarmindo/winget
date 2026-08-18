import { useState } from 'react';
import { Zap, RefreshCw, Trash2, Plus, Edit2, X } from 'lucide-react';
import { useAppStore } from '../stores/store';
import { isTauri } from '../services/tauriBridge';

interface WelcomeScreenProps {
  handleSearch: (q: string) => void;
  openSettings: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ handleSearch, openSettings }) => {
  const { settings, updateSettings, setMode } = useAppStore();

  // In web mode without an API key, searching can't work — guide the user to
  // configure an AI provider instead of firing a doomed search.
  const handleBrowseEssentials = () => {
    if (!isTauri() && !settings.aiConfig.apiKey) {
      openSettings();
      return;
    }
    handleSearch('POPULAR_ESSENTIALS');
  };

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  const handleAdd = (subj: string) => {
    if (subj.trim() && !settings.customSubjects.includes(subj)) {
      updateSettings({ customSubjects: [...settings.customSubjects, subj] });
      setIsAdding(false);
      setNewSubject('');
    }
  };

  const handleRemove = (subj: string) => {
    updateSettings({ customSubjects: settings.customSubjects.filter((s) => s !== subj) });
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-[var(--app-text)] tracking-tight mb-4">
          {settings.activePackageManager === 'winget'
            ? 'WinGet Web Interface'
            : `${settings.activePackageManager.charAt(0).toUpperCase() + settings.activePackageManager.slice(1)} Web Interface`}
        </h1>
        <p className="text-lg text-[var(--app-text-muted)] max-w-2xl mx-auto">
          The modern way to explore, install, and manage system applications.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <button
          onClick={handleBrowseEssentials}
          className="p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-primary)]/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg"
        >
          <div className="bg-[var(--app-primary)]/20 p-3 rounded-xl inline-flex text-[var(--app-primary)] mb-4">
            <Zap size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Browse Essentials</h3>
          <p className="text-sm text-[var(--app-text-muted)]">Discover popular tools for developers and power users.</p>
        </button>
        <button
          onClick={() => setMode('upgrade')}
          className="p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-emerald-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg"
        >
          <div className="bg-emerald-900/30 p-3 rounded-xl inline-flex text-emerald-400 mb-4">
            <RefreshCw size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Check Upgrades</h3>
          <p className="text-sm text-[var(--app-text-muted)]">
            Identify installed apps and generate an upgrade script.
          </p>
        </button>
        <button
          onClick={() => setMode('uninstall')}
          className="p-8 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-red-500/50 hover:bg-[var(--app-bg)] transition-all text-left shadow-lg"
        >
          <div className="bg-red-900/30 p-3 rounded-xl inline-flex text-red-400 mb-4">
            <Trash2 size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Uninstall Apps</h3>
          <p className="text-sm text-[var(--app-text-muted)]">Clean up bloatware and remove unused applications.</p>
        </button>
      </div>
      <div className="text-center">
        <div className="flex justify-center gap-3 flex-wrap">
          {settings.customSubjects.map((s) => (
            <button
              key={s}
              onClick={() => (isEditing ? handleRemove(s) : handleSearch(s.toLowerCase()))}
              className={`px-4 py-2 rounded-full text-sm border ${isEditing ? 'border-red-500 text-red-500' : 'bg-[var(--app-surface)] border-[var(--app-border)]'}`}
            >
              {s} {isEditing && <X size={12} />}
            </button>
          ))}

          {isAdding ? (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
              <input
                autoFocus
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd(newSubject)}
                className="px-4 py-2 rounded-full text-sm bg-[var(--app-surface)] border border-[var(--app-primary)] outline-none w-32"
                placeholder="Tag name..."
              />
              <button
                onClick={() => handleAdd(newSubject)}
                className="p-2 bg-[var(--app-primary)] text-white rounded-full hover:opacity-90"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="p-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="px-4 py-2 rounded-full text-sm border border-dashed border-[var(--app-border)] text-[var(--app-text-muted)] hover:text-[var(--app-primary)] hover:border-[var(--app-primary)] flex items-center gap-2"
            >
              <Plus size={14} /> Add
            </button>
          )}
          <button onClick={() => setIsEditing(!isEditing)} className="p-2 text-[var(--app-text-muted)]">
            <Edit2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
