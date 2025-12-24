import React from 'react';
import { Scale, Sparkles, X } from 'lucide-react';
import { WingetPackage } from '../types';

interface CompareBarProps {
    compareList: WingetPackage[];
    onCompare: () => void;
    onClear: () => void;
}

export const CompareBar: React.FC<CompareBarProps> = ({ compareList, onCompare, onClear }) => {
    if (compareList.length === 0) return null;

    const canCompare = compareList.length >= 2;

    return (
        <div
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-6 fade-in duration-300"
            role="region"
            aria-label="Package comparison selection"
            aria-live="polite"
        >
            <div className="bg-[var(--app-surface)] border border-[var(--app-border)] shadow-2xl rounded-full px-6 py-3 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Scale size={18} className="text-[var(--app-primary)]" />
                    <span>{compareList.length} Selected</span>
                </div>

                <div className="h-6 w-[1px] bg-[var(--app-border)]" />

                <button
                    onClick={onCompare}
                    disabled={!canCompare}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${canCompare
                        ? 'bg-[var(--app-primary)] text-white hover:opacity-90'
                        : 'bg-[var(--app-bg)] text-[var(--app-text-muted)] cursor-not-allowed'
                        }`}
                >
                    <Sparkles size={14} />
                    Compare Selected
                </button>

                <button
                    onClick={onClear}
                    aria-label="Clear comparison selection"
                    className="p-1 hover:bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                >
                    <X size={16} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};
