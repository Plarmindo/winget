import React from 'react';
import { RefreshCw, Trash2, FileWarning, ClipboardPaste, ArrowRight } from 'lucide-react';
import { useAppStore } from '../stores/store';

interface MaintenanceImportProps {
  importText: string;
  setImportText: (text: string) => void;
  importError: string | null;
  handleImport: () => void;
}

export const MaintenanceImport: React.FC<MaintenanceImportProps> = ({ importText, setImportText, importError, handleImport }) => {
  const { mode, settings } = useAppStore();

  return (
    <div className="max-w-3xl mx-auto mt-8">
      <div className={`rounded-2xl border p-8 bg-[var(--app-surface)]/50 ${mode === 'upgrade' ? 'border-emerald-900/50' : 'border-red-900/50'}`}>
        <div className="text-center mb-8">
          <div className={`inline-flex p-4 rounded-full mb-4 bg-opacity-10 ${mode === 'upgrade' ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500'}`}>
            {mode === 'upgrade' ? <RefreshCw size={48} /> : <Trash2 size={48} />}
          </div>
          <h2 className="text-2xl font-bold text-[var(--app-text)] mb-2">
            {mode === 'upgrade' ? 'Check for Upgrades' : 'Bulk Uninstall'}
          </h2>
          <p className="text-[var(--app-text-muted)]">Provide your installed package list for analysis.</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-[var(--app-bg)] p-4 rounded-lg border border-[var(--app-border)]">
              <span className="font-bold text-[var(--app-text)] block mb-1">Step 1</span>
              <span className="text-[var(--app-text-muted)]">Open your terminal (PowerShell, CMD, Bash).</span>
            </div>
            <div className="bg-[var(--app-bg)] p-4 rounded-lg border border-[var(--app-border)]">
              <span className="font-bold text-[var(--app-text)] block mb-1">Step 2</span>
              <span className="text-[var(--app-text-muted)]">Run <code className="bg-[var(--app-surface)] px-1 py-0.5 rounded text-[var(--app-primary)]">{settings.activePackageManager} {mode === 'upgrade' ? 'upgrade' : 'list'}</code></span>
            </div>
            <div className="bg-[var(--app-bg)] p-4 rounded-lg border border-[var(--app-border)]">
              <span className="font-bold text-[var(--app-text)] block mb-1">Step 3</span>
              <span className="text-[var(--app-text-muted)]">Copy the output and paste it below.</span>
            </div>
          </div>

          {importError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-3">
               <FileWarning size={20} className="flex-shrink-0 mt-0.5" />
               <div><p className="font-semibold mb-1">Parsing Failed</p><p>{importError}</p></div>
            </div>
          )}

          <div className="relative">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`Paste output from '${settings.activePackageManager} list' here...`}
              className={`w-full h-48 bg-[var(--app-bg)] border rounded-xl p-4 font-mono text-xs focus:ring-2 focus:outline-none transition-all text-[var(--app-text)] ${
                 mode === 'upgrade' ? 'border-emerald-900/30 focus:border-emerald-500 focus:ring-emerald-900/20' : 
                 'border-red-900/30 focus:border-red-500 focus:ring-red-900/20'
              }`}
            />
            <div className="absolute top-4 right-4 text-[var(--app-text-muted)] pointer-events-none"><ClipboardPaste size={20} /></div>
          </div>

          <button
            onClick={handleImport}
            disabled={!importText.trim()}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${
              !importText.trim() ? 'bg-[var(--app-border)] text-[var(--app-text-muted)] cursor-not-allowed' : mode === 'upgrade' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
            }`}
          >
            <span>Parse Installed Packages</span><ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};