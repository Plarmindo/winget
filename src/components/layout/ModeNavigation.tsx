import React from 'react';
import { Download, RefreshCw, Trash2, Github } from 'lucide-react';
import { AppMode } from '../../types';

interface ModeNavigationProps {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const MODE_CONFIG: Record<AppMode, { icon: typeof Download; color: string }> = {
  install: { icon: Download, color: 'bg-[var(--app-primary)]' },
  upgrade: { icon: RefreshCw, color: 'bg-emerald-600' },
  uninstall: { icon: Trash2, color: 'bg-red-600' },
  github: { icon: Github, color: 'bg-gray-800' },
};

export const ModeNavigation: React.FC<ModeNavigationProps> = ({ mode, setMode }) => {
  return (
    <nav
      className="bg-[var(--app-surface)] border-b border-[var(--app-border)] py-2"
      role="tablist"
      aria-label="Application mode"
    >
      <div className="max-w-7xl mx-auto px-4 flex gap-1 justify-center sm:justify-start">
        {(Object.keys(MODE_CONFIG) as AppMode[]).map((m) => {
          const config = MODE_CONFIG[m];
          const Icon = config.icon;
          const isActive = mode === m;

          return (
            <button
              key={m}
              role="tab"
              aria-selected={isActive}
              aria-label={`Switch to ${m} mode`}
              onClick={() => setMode(m)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive ? `${config.color} text-white` : 'text-[var(--app-text-muted)] hover:bg-[var(--app-bg)]'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="capitalize">{m}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
