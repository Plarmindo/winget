
import React, { useState } from 'react';
import { Copy, CheckCircle, AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { AppMode, PackageManagerType } from '../types';

interface ScriptPreviewProps {
  scriptContent: string;
  mode: AppMode;
  packageManager: PackageManagerType;
  analysis: { total: number; upgrades: number; installs: number };
  excludedCount: number;
  onClose: () => void;
}

export const ScriptPreview: React.FC<ScriptPreviewProps> = ({ scriptContent, mode, packageManager, analysis, excludedCount, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    let ext = 'ps1';
    let mime = 'text/powershell';
    if (packageManager === 'brew' || packageManager === 'apt') {
        ext = 'sh';
        mime = 'application/x-sh';
    }
    
    const blob = new Blob([scriptContent], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${packageManager}-${mode}-script.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  return (
    <div className="space-y-4 flex-1 flex flex-col min-h-0 h-full">
      <div className="flex justify-between items-end">
          <label className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">
            Selection Analysis
          </label>
      </div>
      
      <div className="grid grid-cols-3 gap-2 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg p-3 text-center shrink-0">
          <div className="flex flex-col items-center">
              <span className="text-xs text-[var(--app-text-muted)] mb-1">Total</span>
              <span className="text-sm font-bold text-[var(--app-text)]">{analysis.total}</span>
          </div>
          <div className="flex flex-col items-center">
              <span className="text-xs text-[var(--app-text-muted)] mb-1">Installs</span>
              <span className={`text-sm font-bold ${analysis.installs > 0 ? 'text-[var(--app-primary)]' : 'text-[var(--app-text-muted)]'}`}>{analysis.installs}</span>
          </div>
          <div className="flex flex-col items-center">
              <span className="text-xs text-[var(--app-text-muted)] mb-1">Upgrades</span>
              <span className={`text-sm font-bold ${analysis.upgrades > 0 ? 'text-emerald-400' : 'text-[var(--app-text-muted)]'}`}>{analysis.upgrades}</span>
          </div>
      </div>

      <div className="relative group flex-1 overflow-hidden flex flex-col min-h-[200px]">
        <pre className={`p-4 rounded-lg text-xs font-mono overflow-auto whitespace-pre border bg-black/50 shadow-inner flex-1 ${
            mode === 'upgrade' ? 'text-emerald-300 border-emerald-900/30' :
            mode === 'uninstall' ? 'text-red-300 border-red-900/30' :
            'text-blue-300 border-blue-900/30'
        }`}>
          {scriptContent}
        </pre>
        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-2 bg-[var(--app-surface)] hover:bg-[var(--app-border)] text-[var(--app-text)] rounded shadow-lg border border-[var(--app-border)] transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
        </div>
      </div>
      
      {excludedCount > 0 && mode === 'upgrade' && (
          <div className="shrink-0 text-[10px] text-amber-500 flex items-center gap-2 bg-amber-900/20 px-3 py-2 rounded border border-amber-900/30">
            <AlertTriangle size={12} />
            <span>{excludedCount} items are already up-to-date and were excluded from the script.</span>
          </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-[var(--app-border)] mt-auto shrink-0">
          <button
            onClick={handleDownload}
            className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all ${
              downloaded
                ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' 
                : 'bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-border)] border border-[var(--app-border)]'
            }`}
            title="Download file"
          >
            {downloaded ? (
              <>
                  <CheckCircle size={18} />
                  <span>Saved</span>
              </>
            ) : (
              <>
                  <Download size={18} />
                  <span>Download</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleCopy}
            className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all ${
              copied 
                ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' 
                : 'bg-[var(--app-primary)] hover:opacity-90 text-white shadow-lg shadow-blue-900/20'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle size={18} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={18} />
                <span>Copy Text</span>
              </>
            )}
          </button>
          
          <button 
            onClick={onClose}
            className="px-4 py-3 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] text-[var(--app-text)] rounded-lg font-semibold border border-[var(--app-border)]"
            title="Regenerate"
          >
              <RotateCcw size={18} />
          </button>
      </div>
    </div>
  );
};
