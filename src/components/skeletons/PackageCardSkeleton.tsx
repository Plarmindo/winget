import React from 'react';

export const PackageCardSkeleton: React.FC = () => {
  return (
    <div className="bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] p-6 relative overflow-hidden">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="shimmer-animation absolute inset-0 opacity-20"></div>
      </div>

      {/* Content structure matching PackageCard */}
      <div className="relative space-y-3">
        {/* Header (star icon + title) */}
        <div className="flex items-start gap-3">
          {/* Star placeholder */}
          <div className="w-6 h-6 rounded bg-[var(--app-border)] animate-pulse"></div>

          {/* Title */}
          <div className="flex-1">
            <div className="h-6 w-3/4 bg-[var(--app-border)] rounded animate-pulse"></div>
          </div>
        </div>

        {/* ID */}
        <div className="h-4 w-1/2 bg-[var(--app-border)] rounded animate-pulse"></div>

        {/* Description */}
        <div className="space-y-2">
          <div className="h-3 w-full bg-[var(--app-border)] rounded animate-pulse"></div>
          <div className="h-3 w-5/6 bg-[var(--app-border)] rounded animate-pulse"></div>
        </div>

        {/* Version */}
        <div className="h-4 w-24 bg-[var(--app-border)] rounded animate-pulse"></div>

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
