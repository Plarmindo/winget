import React, { useMemo } from 'react';
import { X, Star, Search as SearchIcon } from 'lucide-react';
import { AppMode, WingetPackage } from '../types';
import { PRESET_CATEGORIES } from '../constants';
import { useAppStore } from '../stores/store';
import { PackageGrid } from './PackageGrid';
import { WelcomeScreen } from './WelcomeScreen';
import { MaintenanceImport } from './MaintenanceImport';
import { GitHubPanel } from './GitHubPanel';
import { FilterBar } from './FilterBar';
import { EmptyState } from './EmptyState';
import ErrorBoundary from './ErrorBoundary';

interface ContentAreaProps {
    packages: WingetPackage[];
    mode: AppMode;
    loading: boolean;
    searched: boolean;
    query: string;
    error: any;
    isDesktop: boolean;

    // Import state
    importText: string;
    setImportText: (text: string) => void;
    importError: string | null;

    // Handlers
    handleSearch: (query: string) => void;
    handleImport: () => void;
    handleDirectExecution: (id: string, mode: AppMode) => void;
    handleFetchAiDetails: (pkg: WingetPackage) => Promise<string>;
    handleDirectInstall: (id: string) => void;
    handleGitHubAction: (id: string, action: import('../types').GitHubAction) => void;
    executeOperation: (url: string, mode: AppMode) => void;
    openSettings: () => void;

    // Setters from store
    setError: (error: any) => void;
    setPackages: (packages: WingetPackage[]) => void;
    setSearched: (searched: boolean) => void;
    setQuery: (query: string) => void;
}

export const ContentArea: React.FC<ContentAreaProps> = ({
    packages,
    mode,
    loading,
    searched,
    query,
    error,
    isDesktop,
    importText,
    setImportText,
    importError,
    handleSearch,
    handleImport,
    handleDirectExecution,
    handleFetchAiDetails,
    handleDirectInstall,
    handleGitHubAction,
    executeOperation,
    openSettings,
    setError,
    setPackages,
    setSearched,
    setQuery,
}) => {
    const { settings, sortBy } = useAppStore();

    // Must be declared before any conditional returns (Rules of Hooks).
    // Stable reference prevents PackageGrid from resetting to page 1 on unrelated re-renders.
    const sortedPackages = useMemo(() => [...packages].sort((a, b) => {
        if (sortBy === 'name-asc') {
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortBy === 'name-desc') {
            return (b.name || '').localeCompare(a.name || '');
        } else if (sortBy === 'manager') {
            const managerA = a.source || '';
            const managerB = b.source || '';
            if (managerA !== managerB) {
                return managerA.localeCompare(managerB);
            }
            return (a.name || '').localeCompare(b.name || '');
        }
        return 0;
    }), [packages, sortBy]);

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-red-500/10 text-red-500 p-4 rounded-full mb-4">
                    <X size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Something went wrong</h3>
                <div className="text-left bg-[var(--app-surface)] border border-red-500/20 p-4 rounded-lg mb-6 w-full max-w-2xl overflow-auto max-h-[300px]">
                    <pre className="whitespace-pre-wrap text-sm font-mono text-[var(--app-text)]">
                        {typeof error === 'string' ? error : (error.message || "An unexpected error occurred.")}
                    </pre>
                </div>
                <button
                    onClick={() => { setError(null); handleSearch(query || "POPULAR_ESSENTIALS"); }}
                    className="px-6 py-2 bg-[var(--app-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                >
                    Try Again
                </button>
            </div>
        );
    }

    // Welcome/Empty state for non-searched modes
    if (packages.length === 0 && !searched && !loading && mode !== 'github') {
        if (mode === 'install') {
            return (
                <WelcomeScreen
                    handleSearch={handleSearch}
                    openSettings={openSettings}
                />
            );
        }
        return (
            <MaintenanceImport
                importText={importText}
                setImportText={setImportText}
                importError={importError}
                handleImport={handleImport}
            />
        );
    }

    // No results after search
    if (packages.length === 0 && searched && !loading && mode !== 'github') {
        return (
            <div className="text-center py-12">
                <p className="text-[var(--app-text-muted)]">No packages found.</p>
            </div>
        );
    }

    // GitHub mode
    if (mode === 'github') {
        return (
            <ErrorBoundary>
                <GitHubPanel
                    token={settings.githubToken}
                    query={query}
                    onClone={(url, _name) => executeOperation(url, 'install')}
                    onDirectInstall={handleDirectInstall}
                    onFetchDetails={handleFetchAiDetails}
                />
            </ErrorBoundary>
        );
    }

    return (
        <>
            {/* Category buttons - only show in install mode */}
            {mode === 'install' && (
                <div className="flex flex-wrap gap-2 mb-8">
                    <button
                        onClick={() => handleSearch("POPULAR_ESSENTIALS")}
                        className="px-4 py-1.5 rounded-full text-xs font-medium border bg-[var(--app-primary)]/10 text-[var(--app-primary)] border-[var(--app-primary)]/30"
                    >
                        Essentials
                    </button>
                    <button
                        onClick={() => {
                            const { favorites, packages: allPackages } = useAppStore.getState();
                            const favPackages = allPackages.filter(p => favorites.includes(p.id));
                            if (favPackages.length > 0) {
                                setPackages(favPackages);
                                setSearched(true);
                            } else {
                                setError('No favorites yet. Star some packages to see them here!');
                            }
                        }}
                        className="px-4 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 flex items-center gap-1"
                    >
                        <Star size={12} className="fill-current" />
                        Favorites
                    </button>
                    {PRESET_CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleSearch(cat.toLowerCase())}
                            className="px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)] hover:bg-[var(--app-border)] hover:text-[var(--app-text)]"
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">
                    {searched ? (query ? `Results for "${query}"` : 'Recommended') : 'Popular'}
                </h2>
            </div>

            {/* Filter Bar - show when packages exist */}
            {packages.length > 0 && <FilterBar />}

            {/* Package Grid or Empty State */}
            <div className="w-full mb-8">
                {searched && packages.length === 0 && !loading ? (
                    <EmptyState
                        icon={SearchIcon}
                        title="No packages found"
                        description={query ? `No results for "${query}". Try different keywords or check your package manager settings.` : "Search for packages to get started."}
                        action={query ? {
                            label: "Clear Search",
                            onClick: () => {
                                setQuery('');
                                setPackages([]);
                                setSearched(false);
                            }
                        } : undefined}
                    />
                ) : (
                    <PackageGrid
                        packages={sortedPackages}
                        onExecute={handleDirectExecution}
                        handleSearch={handleSearch}
                        onFetchDetails={handleFetchAiDetails}
                        onDirectInstall={handleDirectInstall}
                        onGitHubAction={handleGitHubAction}
                        isDesktop={isDesktop}
                        loading={loading}
                    />
                )}
            </div>
        </>
    );
};
