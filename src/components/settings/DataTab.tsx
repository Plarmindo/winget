import React from 'react';
import { Database, ArrowUpCircle, ArrowDownCircle, ShieldAlert } from 'lucide-react';
import { STORAGE_KEYS } from '../../constants';
import { showToast } from '../../stores/toastStore';

interface DataTabProps {
  onClearData: (type: 'cart' | 'chat' | 'all') => void;
}

export const DataTab: React.FC<DataTabProps> = ({ onClearData }) => {
  const handleExportData = () => {
    const exportData = {
      settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}'),
      cart: JSON.parse(localStorage.getItem(STORAGE_KEYS.CART) || '[]'),
      chat: JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT) || '[]'),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winget-backup-${new Date().toISOString().split('T')[0]}.json`;
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
        showToast('Data imported successfully. Refreshing...', 'success');
        // Give the toast a moment to render before the reload clears the screen.
        setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        showToast('Failed to parse import file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Database size={20} /> Backup & Restore
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleExportData}
            className="group p-6 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl flex flex-col items-center justify-center gap-4 text-[var(--app-text)] transition-all hover:border-[var(--app-primary)] hover:shadow-lg"
          >
            <div className="p-4 bg-[var(--app-primary)]/10 text-[var(--app-primary)] rounded-full group-hover:scale-110 transition-transform">
              <ArrowUpCircle size={32} />
            </div>
            <div className="text-center">
              <span className="font-bold block text-lg">Export Data</span>
              <span className="text-xs text-[var(--app-text-muted)]">Save settings, cart, and history to JSON.</span>
            </div>
          </button>

          <label className="group p-6 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl flex flex-col items-center justify-center gap-4 text-[var(--app-text)] transition-all hover:border-emerald-500 hover:shadow-lg cursor-pointer">
            <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-full group-hover:scale-110 transition-transform">
              <ArrowDownCircle size={32} />
            </div>
            <div className="text-center">
              <span className="font-bold block text-lg">Import Data</span>
              <span className="text-xs text-[var(--app-text-muted)]">Restore from a previously saved JSON file.</span>
            </div>
            <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-500">
          <ShieldAlert size={20} /> Danger Zone
        </h3>
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden">
          <div className="divide-y divide-red-500/10">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[var(--app-text)]">Clear Shopping Cart</p>
                <p className="text-xs text-[var(--app-text-muted)]">Removes all items from your selection.</p>
              </div>
              <button
                onClick={() => onClearData('cart')}
                className="px-4 py-2 bg-[var(--app-surface)] hover:bg-red-500 hover:text-white text-[var(--app-text)] border border-[var(--app-border)] hover:border-red-500 rounded-lg text-xs font-bold transition-all"
              >
                Clear Cart
              </button>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-sm text-[var(--app-text)]">Clear Chat History</p>
                <p className="text-xs text-[var(--app-text-muted)]">Deletes all AI conversation logs locally.</p>
              </div>
              <button
                onClick={() => onClearData('chat')}
                className="px-4 py-2 bg-[var(--app-surface)] hover:bg-red-500 hover:text-white text-[var(--app-text)] border border-[var(--app-border)] hover:border-red-500 rounded-lg text-xs font-bold transition-all"
              >
                Clear Chat
              </button>
            </div>
            <div className="p-4 flex items-center justify-between bg-red-500/10">
              <div>
                <p className="font-bold text-sm text-red-500">Factory Reset</p>
                <p className="text-xs text-red-400">Wipes ALL data including settings and themes.</p>
              </div>
              <button
                onClick={() => onClearData('all')}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-red-900/20"
              >
                Reset App
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
