import React from 'react';
import { Command } from 'lucide-react';

interface CommandItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
}

export const CommandItem: React.FC<CommandItemProps> = ({ icon, label, shortcut, onClick, active }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
      active
        ? 'bg-[var(--app-surface)] text-[var(--app-text)]'
        : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]'
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

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  commands: { id: string; label: string; icon: React.ReactNode; action: () => void }[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  inputRef,
  searchTerm,
  setSearchTerm,
  commands,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-[var(--app-border)]">
          <Command size={18} className="text-[var(--app-text-muted)] mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command..."
            className="flex-1 bg-transparent border-none focus:outline-none text-[var(--app-text)] placeholder-[var(--app-text-muted)]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="text-xs text-[var(--app-text-muted)] border border-[var(--app-border)] px-1.5 rounded">
            ESC
          </span>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-2">
          <div className="px-3 py-1 text-xs font-semibold text-[var(--app-text-muted)] uppercase">Suggestions</div>
          {commands.length > 0 ? (
            commands.map((cmd) => (
              <CommandItem
                key={cmd.id}
                icon={cmd.icon}
                label={cmd.label}
                onClick={() => {
                  cmd.action();
                  onClose();
                }}
              />
            ))
          ) : (
            <div className="px-4 py-3 text-[var(--app-text-muted)] text-sm">No commands found.</div>
          )}
        </div>
      </div>
    </div>
  );
};
