import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = '',
}) => {
    return (
        <div className={`flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in ${className}`}>
            <div className="mb-6 p-4 rounded-full bg-[var(--app-border)]/30">
                <Icon size={48} className="text-[var(--app-text-muted)] opacity-50" />
            </div>
            <h3 className="text-xl font-semibold text-[var(--app-text)] mb-2">
                {title}
            </h3>
            <p className="text-sm text-[var(--app-text-muted)] max-w-md mb-6">
                {description}
            </p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-6 py-2.5 rounded-lg bg-[var(--app-primary)] text-white font-medium hover:opacity-90 transition-opacity"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
