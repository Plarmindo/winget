import React from 'react';
import { Github, MonitorSmartphone } from 'lucide-react';
import AppLogo from '../AppLogo';

export const AboutTab: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="relative group">
        <div className="absolute inset-0 bg-[var(--app-primary)] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
        <div className="relative p-6 bg-[var(--app-bg)] rounded-3xl border border-[var(--app-border)] shadow-2xl">
          <AppLogo size={64} className="text-[var(--app-primary)]" />
        </div>
      </div>

      <div>
        <h3 className="text-3xl font-bold mb-2 tracking-tight">WinGet Web Interface</h3>
        <p className="text-[var(--app-primary)] font-mono text-sm bg-[var(--app-primary)]/10 px-3 py-1 rounded-full inline-block mb-4">
          v{__APP_VERSION__} • Stable
        </p>
        <p className="text-[var(--app-text-muted)] max-w-sm mx-auto leading-relaxed">
          A sovereign, intelligent interface for package management. Designed for power users who prefer visual
          discovery over CLI memorization.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <a
          href="#"
          className="p-4 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl flex flex-col items-center gap-2 transition-all hover:border-[var(--app-primary)] group"
        >
          <Github size={24} className="text-[var(--app-text-muted)] group-hover:text-[var(--app-text)]" />
          <span className="text-xs font-bold">Source Code</span>
        </a>
        <a
          href="#"
          className="p-4 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl flex flex-col items-center gap-2 transition-all hover:border-[var(--app-primary)] group"
        >
          <MonitorSmartphone size={24} className="text-[var(--app-text-muted)] group-hover:text-[var(--app-text)]" />
          <span className="text-xs font-bold">Website</span>
        </a>
      </div>

      <div className="text-[10px] text-[var(--app-text-muted)] opacity-50">MIT License • Built with React & Rust</div>
    </div>
  );
};
