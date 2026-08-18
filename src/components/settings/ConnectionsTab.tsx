import React, { useState } from 'react';
import { Github, Check, X, Loader2 } from 'lucide-react';
import { AppSettings } from '../../types';
import { validateGitHubToken } from '../../services/githubService';
import { saveGitHubToken, deleteGitHubToken } from '../../services/tauriBridge';

interface ConnectionsTabProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

export const ConnectionsTab: React.FC<ConnectionsTabProps> = ({ settings, onUpdateSettings }) => {
  const [token, setToken] = useState(settings.githubToken || '');
  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');

  const handleSave = async () => {
    setStatus('validating');
    const isValid = await validateGitHubToken(token);

    if (isValid) {
      setStatus('success');
      // Store token securely in OS keychain
      await saveGitHubToken(token);
      // Clear from settings (no longer persisted to localStorage)
      onUpdateSettings({ ...settings, githubToken: '' });
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setStatus('error');
    }
  };

  const handleClear = async () => {
    await deleteGitHubToken();
    setToken('');
    onUpdateSettings({ ...settings, githubToken: '' });
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Github size={24} /> GitHub Integration
        </h3>
        <p className="text-sm text-[var(--app-text-muted)]">
          Connect your account to search and clone repositories directly.
        </p>
      </div>

      <div className="bg-[var(--app-bg)]/50 border border-[var(--app-border)] rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-[var(--app-text-muted)] uppercase tracking-wider block mb-2">
            Personal Access Token (PAT)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--app-primary)] outline-none"
            />
            <button
              onClick={handleSave}
              disabled={status === 'validating'}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                status === 'success'
                  ? 'bg-green-600 text-white'
                  : status === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-[var(--app-primary)] text-white hover:opacity-90'
              }`}
            >
              {status === 'validating' && <Loader2 size={16} className="animate-spin" />}
              {status === 'success' && <Check size={16} />}
              {status === 'error' && <X size={16} />}
              {status === 'idle'
                ? 'Verify & Save'
                : status === 'success'
                  ? 'Saved'
                  : status === 'error'
                    ? 'Invalid'
                    : 'Checking'}
            </button>
          </div>
          {token && status === 'success' && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded w-fit">
              <Check size={12} />
              <span>Token saved securely to OS keychain (ends in {token.slice(-4)})</span>
              <button onClick={handleClear} className="ml-2 text-[var(--app-text-muted)] hover:text-red-500 underline">
                Clear
              </button>
            </div>
          )}
          <p className="text-xs text-[var(--app-text-muted)] mt-2">
            Generate a token in GitHub Settings &gt; Developer Settings &gt; Personal Access Tokens (Classic). Scopes
            needed: <code>repo</code> (for private repos) or none (public only).
          </p>
        </div>
      </div>
    </div>
  );
};
