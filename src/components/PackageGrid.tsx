
import React, { useState, useEffect } from 'react';
import { WingetPackage, AppMode, GitHubAction } from '../types';
import { PackageCard } from './PackageCard';
import { useAppStore } from '../stores/store';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PackageGridProps {
  packages: WingetPackage[];
  onExecute?: (id: string, mode: AppMode) => void;
  handleSearch: (query: string) => void;
  onFetchDetails?: (pkg: WingetPackage) => Promise<string>;
  onGitHubAction?: (id: string, action: GitHubAction) => void;
  isDesktop?: boolean;
}

export const PackageGrid: React.FC<PackageGridProps> = ({
  packages, onExecute, handleSearch, onFetchDetails, onGitHubAction, isDesktop
}) => {
  const { settings } = useAppStore();
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when packages list changes (new search)
  useEffect(() => {
    setCurrentPage(1);
  }, [packages]);

  if (packages.length === 0) return null;

  const itemsPerPage = Number(settings.itemsPerPage) > 0 ? Number(settings.itemsPerPage) : 6;
  const totalPages = Math.ceil(packages.length / itemsPerPage);

  // Ensure current page is valid
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));

  const startIndex = (safePage - 1) * itemsPerPage;
  const currentPackages = packages.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const handleNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Grid Layout */}
      <div className={`grid grid-cols-1 ${settings.compactMode ? 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4`}>
        {currentPackages.map((pkg) => (
          <div key={pkg.id} className="h-full">
            <PackageCard
              pkg={pkg}
              onExecute={onExecute}
              handleSearch={handleSearch}
              onFetchDetails={onFetchDetails}
              onGitHubAction={onGitHubAction}
              isDesktop={isDesktop}
              style={{ height: '100%' }}
            />
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4 pb-8">
          <button
            onClick={handlePrev}
            disabled={safePage === 1}
            className={`p-2 rounded-full border border-[var(--app-border)] transition-colors ${safePage === 1 ? 'text-[var(--app-text-muted)] opacity-50 cursor-not-allowed' : 'hover:bg-[var(--app-surface)] text-[var(--app-text)]'}`}
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-sm font-medium text-[var(--app-text-muted)]">
            Page <span className="text-[var(--app-text)] font-bold">{safePage}</span> of {totalPages}
          </span>

          <button
            onClick={handleNext}
            disabled={safePage === totalPages}
            className={`p-2 rounded-full border border-[var(--app-border)] transition-colors ${safePage === totalPages ? 'text-[var(--app-text-muted)] opacity-50 cursor-not-allowed' : 'hover:bg-[var(--app-surface)] text-[var(--app-text)]'}`}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
};
