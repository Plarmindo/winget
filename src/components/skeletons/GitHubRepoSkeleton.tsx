import React from 'react';

export const GitHubRepoSkeleton: React.FC = () => {
    return (
        <div className="bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] p-6 relative overflow-hidden">
            {/* Shimmer overlay */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="shimmer-animation absolute inset-0 opacity-20"></div>
            </div>

            {/* Content structure matching GitHub repo card */}
            <div className="relative space-y-3">
                {/* Header (icon + title) */}
                <div className="flex items-start gap-3">
                    {/* Icon placeholder */}
                    <div className="w-10 h-10 rounded-lg bg-[var(--app-border)] animate-pulse"></div>

                    {/* Title and owner */}
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-2/3 bg-[var(--app-border)] rounded animate-pulse"></div>
                        <div className="h-3 w-1/3 bg-[var(--app-border)] rounded animate-pulse"></div>
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <div className="h-3 w-full bg-[var(--app-border)] rounded animate-pulse"></div>
                    <div className="h-3 w-4/5 bg-[var(--app-border)] rounded animate-pulse"></div>
                </div>

                {/* Stats (stars, forks, etc.) */}
                <div className="flex gap-4">
                    <div className="h-4 w-16 bg-[var(--app-border)] rounded animate-pulse"></div>
                    <div className="h-4 w-16 bg-[var(--app-border)] rounded animate-pulse"></div>
                    <div className="h-4 w-20 bg-[var(--app-border)] rounded animate-pulse"></div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                    <div className="h-9 flex-1 bg-[var(--app-border)] rounded-lg animate-pulse"></div>
                    <div className="h-9 w-9 bg-[var(--app-border)] rounded-lg animate-pulse"></div>
                    <div className="h-9 w-9 bg-[var(--app-border)] rounded-lg animate-pulse"></div>
                </div>
            </div>
        </div>
    );
};
