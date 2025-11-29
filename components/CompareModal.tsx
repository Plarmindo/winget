
import React from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: string | null;
  isLoading: boolean;
}

export const CompareModal: React.FC<CompareModalProps> = ({ isOpen, onClose, result, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden text-[var(--app-text)] relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[var(--app-border)] flex items-center justify-between bg-[var(--app-surface)]">
          <div className="flex items-center gap-2">
            <Sparkles size={24} className="text-[var(--app-primary)]" />
            <h2 className="text-xl font-bold">Package Comparison</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--app-bg)] rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[var(--app-bg)]/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--app-text-muted)] space-y-4">
              <Loader2 size={48} className="animate-spin text-[var(--app-primary)]" />
              <div className="text-center">
                <p className="text-lg font-medium text-[var(--app-text)]">Analyzing Packages...</p>
                <p className="text-sm">Comparing features, pros, cons, and gathering data.</p>
              </div>
            </div>
          ) : result ? (
             <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap leading-relaxed">
                   {/* 
                     Since we don't have a markdown parser installed in this environment example,
                     we display whitespace-pre-wrap. In a real scenario, use react-markdown.
                   */}
                   {result}
                </div>
             </div>
          ) : (
             <div className="text-center text-[var(--app-text-muted)]">
                No comparison data available.
             </div>
          )}
        </div>
        
        <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-surface)] flex justify-end">
           <button onClick={onClose} className="px-6 py-2 bg-[var(--app-primary)] text-white rounded-lg font-bold hover:opacity-90">
             Close
           </button>
        </div>
      </div>
    </div>
  );
};
