import React from 'react';
import { ArrowUpAZ, ArrowDownAZ, Layers } from 'lucide-react';
import { useAppStore } from '../stores/store';

export const FilterBar: React.FC = () => {
    const { sortBy, setSortBy } = useAppStore();

    const sortOptions = [
        { value: 'name-asc' as const, label: 'Name (A-Z)', icon: ArrowUpAZ },
        { value: 'name-desc' as const, label: 'Name (Z-A)', icon: ArrowDownAZ },
        { value: 'manager' as const, label: 'Manager', icon: Layers },
    ];

    return (
        <div className="flex items-center gap-3 mb-4 px-1">
            <span className="text-sm text-[var(--app-text-muted)] font-medium">Sort by:</span>
            <div className="flex gap-2 flex-wrap">
                {sortOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = sortBy === option.value;
                    return (
                        <button
                            key={option.value}
                            onClick={() => setSortBy(option.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${isActive
                                    ? 'bg-[var(--app-primary)] text-white'
                                    : 'bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)] hover:bg-[var(--app-border)] hover:text-[var(--app-text)]'
                                }`}
                        >
                            <Icon size={14} />
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
