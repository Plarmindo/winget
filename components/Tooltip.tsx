import React from 'react';

export const Tooltip: React.FC<{ children: React.ReactNode; content: string }> = ({ children, content }) => {
  return (
    <div className="group relative flex flex-col items-center">
      {children}
      <div className="absolute top-full mt-2 px-3 py-1.5 bg-[var(--app-surface)] text-xs text-[var(--app-text)] rounded-md border border-[var(--app-border)] shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--app-surface)] border-t border-l border-[var(--app-border)] transform rotate-45"></div>
        {content}
      </div>
    </div>
  );
};
