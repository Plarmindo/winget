import React from 'react';

export const GitHubDetailsSkeleton: React.FC = () => {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      {/* Latest Release Skeleton */}
      <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
        <div className="h-4 w-32 bg-[var(--app-surface)] rounded mb-2"></div>
        <div className="h-3 w-48 bg-[var(--app-surface)] rounded"></div>
      </div>

      {/* Branches Skeleton */}
      <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
        <div className="h-4 w-24 bg-[var(--app-surface)] rounded mb-2"></div>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 w-16 bg-[var(--app-surface)] rounded"></div>
          ))}
        </div>
      </div>

      {/* Recent Commits Skeleton */}
      <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
        <div className="h-4 w-32 bg-[var(--app-surface)] rounded mb-2"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 w-full bg-[var(--app-surface)] rounded"></div>
          ))}
        </div>
      </div>

      {/* Issues & PRs Skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
          <div className="h-4 w-24 bg-[var(--app-surface)] rounded mb-2"></div>
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-full bg-[var(--app-surface)] rounded"></div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
          <div className="h-4 w-24 bg-[var(--app-surface)] rounded mb-2"></div>
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 w-full bg-[var(--app-surface)] rounded"></div>
            ))}
          </div>
        </div>
      </div>

      {/* README Skeleton */}
      <div className="bg-[var(--app-bg)] rounded-lg p-3 border border-[var(--app-border)]">
        <div className="h-4 w-20 bg-[var(--app-surface)] rounded mb-2"></div>
        <div className="h-32 w-full bg-[var(--app-surface)] rounded"></div>
      </div>
    </div>
  );
};
