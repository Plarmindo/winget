import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Trash2, Download, Scale, X, Sparkles } from 'lucide-react';
import { AppMode, WingetPackage } from './types';
import { parseWingetOutput, generateAppDetailsPrompt, generateComparisonPrompt, generateAIResponse, executeRealCommand } from './services/wingetService';
import { isTauri } from './services/tauriBridge';
import { PRESET_CATEGORIES, STORAGE_KEYS, DEFAULT_THEMES } from './constants';
import { useAppStore } from './stores/store';
import { usePackageOperations } from './hooks/usePackageOperations';
import { useSearchLogic } from './hooks/useSearchLogic';

// Components
import { PackageGrid } from './components/PackageGrid';
import { ScriptDrawer } from './components/ScriptDrawer';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { Navbar } from './components/Navbar';
import { MaintenanceImport } from './components/MaintenanceImport';
import { SearchInput } from './components/SearchInput';
import { CompareModal } from './components/CompareModal';
import { HelpModal } from './components/HelpModal';

function App() {
  // Global Store
  const {
    settings,
    mode, setMode,
    query, setQuery,
    packages, setPackages,
    loading, setLoading,
    setError,
    clearCart,
    compareList, clearCompare,
    setPendingChatQuery, pendingChatQuery
  } = useAppStore();

  // Custom Hooks
  const { executeOperation } = usePackageOperations();
  const { handleSearch, handleStopSearch, searched, setSearched, setHasMore } = useSearchLogic();

  // Local UI State (Modals)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Import State
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Desktop State
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isTauri());
  }, []);

  // Listen for progress events
  useEffect(() => {
    if (!isTauri()) return;

    // We need to dynamically import the event module or use window.__TAURI__
    // Since we don't have the tauri API types fully set up in this context, we'll use the window object
    const setupListener = async () => {
      try {
        // @ts-ignore
        if (window.__TAURI__ && window.__TAURI__.event) {
          // @ts-ignore
          const unlisten = await window.__TAURI__.event.listen('operation-progress', (event) => {
            const progress = event.payload;
            // console.log('Progress:', progress);

            if (progress.percent === 100) {
              setLoading(false);
            }
          });
          return unlisten;
        }
      } catch (e) {
        console.error("Failed to setup progress listener", e);
      }
    };

    let unlistenFn: (() => void) | undefined;
    setupListener().then(fn => unlistenFn = fn);

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, []);

  // Apply Theme
  useEffect(() => {
    const activeTheme = settings.themes.find(t => t.id === settings.activeThemeId) || DEFAULT_THEMES[0];
    if (activeTheme && activeTheme.colors) {
      const root = document.documentElement;
      root.style.setProperty('--app-bg', activeTheme.colors.bg);
      root.style.setProperty('--app-surface', activeTheme.colors.surface);
      root.style.setProperty('--app-border', activeTheme.colors.border);
      root.style.setProperty('--app-text', activeTheme.colors.text);
      root.style.setProperty('--app-text-muted', activeTheme.colors.textMuted);
      root.style.setProperty('--app-primary', activeTheme.colors.primary);
      root.style.setProperty('--app-primary-hover', activeTheme.colors.primaryHover);
    }
  }, [settings.activeThemeId, settings.themes]);

  // Reset on Mode Change
  useEffect(() => {
    setPackages([]);
    setSearched(false);
    setQuery('');
    setImportText('');
    setImportError(null);
    setError(null);
    setHasMore(true);
    setLoading(false);
    handleStopSearch();
    clearCompare();
  }, [mode]);

  const handleClearData = (type: 'cart' | 'chat' | 'all') => {
    if (type === 'cart' || type === 'all') clearCart();
    if (type === 'chat' || type === 'all') { localStorage.removeItem(STORAGE_KEYS.CHAT); window.location.reload(); }
    if (type === 'all') { useAppStore.persist.clearStorage(); window.location.reload(); }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    setIsImporting(true); setImportError(null); setError(null);
    setTimeout(() => {
      try {
        const parsed = parseWingetOutput(importText);
        if (parsed.length === 0) { setImportError("No packages found."); setPackages([]); }
        else { setPackages(parsed); setSearched(true); setImportText(''); }
      } catch { setImportError("Parsing error."); } finally { setIsImporting(false); }
    }, 500);
  };

  const runComparison = async () => {
    if (compareList.length < 2) return;
    setIsCompareModalOpen(true);
    setIsComparing(true);
    setCompareResult(null);

    try {
      const prompt = generateComparisonPrompt(compareList);
      const result = await generateAIResponse(settings, prompt, "You are a software comparison expert. Provide detailed, unbiased comparisons in markdown format.");
      setCompareResult(result);
    } catch (e) {
      setCompareResult("Failed to generate comparison. Please check AI settings.");
    } finally {
      setIsComparing(false);
    }
  };

  const handleFetchAiDetails = async (pkg: WingetPackage): Promise<string> => {
    const basePrompt = generateAppDetailsPrompt(pkg.name, pkg.id);
    const prompt = `${basePrompt}\nConstraint: Keep the response under 80 words. Focus on key features.`;
    return await generateAIResponse(settings, prompt, "You are a helpful software assistant.", false);
  };

  const handleDirectExecution = (id: string, currentMode: AppMode) => {
    executeOperation(id, currentMode);
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-red-500/10 text-red-500 p-4 rounded-full mb-4">
            <X size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Something went wrong</h3>
          <p className="text-[var(--app-text-muted)] max-w-md mb-6">
            {typeof error === 'string' ? error : (error.message || "An unexpected error occurred.")}
          </p>
          <button
            onClick={() => { setError(null); handleSearch(query || "POPULAR_ESSENTIALS"); }}
            className="px-6 py-2 bg-[var(--app-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      );
    }

    if (packages.length === 0 && !searched && !loading) {
      return (
        <MaintenanceImport
          importText={importText}
          setImportText={setImportText}
          importError={importError}
          handleImport={handleImport}
        />
      );
    }

    if (packages.length === 0 && searched && !loading) {
      return (
        <div className="text-center py-12">
          <p className="text-[var(--app-text-muted)]">No packages found.</p>
        </div>
      );
    }

    return (
      <>
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => handleSearch("POPULAR_ESSENTIALS")} className="px-4 py-1.5 rounded-full text-xs font-medium border bg-[var(--app-primary)]/10 text-[var(--app-primary)] border-[var(--app-primary)]/30">Essentials</button>
          {PRESET_CATEGORIES.map(cat => <button key={cat} onClick={() => handleSearch(cat.toLowerCase())} className="px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)] hover:bg-[var(--app-border)] hover:text-[var(--app-text)]">{cat}</button>)}
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{searched ? (query ? `Results for "${query}"` : 'Recommended') : 'Popular'}</h2>
        </div>

        <div className="w-full mb-8">
          <PackageGrid
            packages={packages}
            onExecute={handleDirectExecution}
            handleSearch={handleSearch}
            onFetchDetails={handleFetchAiDetails}
            isDesktop={isDesktop}
          />
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col font-sans relative transition-colors duration-300">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearData={handleClearData}
      />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <CompareModal isOpen={isCompareModalOpen} onClose={() => setIsCompareModalOpen(false)} result={compareResult} isLoading={isComparing} />

      <Navbar
        handleSearch={handleSearch}
        stopSearch={handleStopSearch}
        openDrawer={() => setIsDrawerOpen(true)}
        openSettings={() => setIsSettingsOpen(true)}
        openHelp={() => setIsHelpOpen(true)}
        isDesktop={isDesktop}
        resetState={() => { setMode('install'); setSearched(false); setPackages([]); setQuery(''); setError(null); }}
      />

      <div className="bg-[var(--app-surface)] border-b border-[var(--app-border)] py-2"><div className="max-w-7xl mx-auto px-4 flex gap-1 justify-center sm:justify-start">
        {['install', 'upgrade', 'uninstall'].map(m => <button key={m} onClick={() => setMode(m as AppMode)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? (m === 'upgrade' ? 'bg-emerald-600 text-white' : m === 'uninstall' ? 'bg-red-600 text-white' : 'bg-[var(--app-primary)] text-white') : 'text-[var(--app-text-muted)] hover:bg-[var(--app-bg)]'}`}>{m === 'install' ? <Download size={16} /> : m === 'upgrade' ? <RefreshCw size={16} /> : <Trash2 size={16} />} <span className="capitalize">{m}</span></button>)}
      </div></div>

      {mode === 'install' && (
        <div className="md:hidden p-4 border-b border-[var(--app-border)] bg-[var(--app-surface)]/50">
          <SearchInput
            value={query}
            onChange={setQuery}
            onSearch={handleSearch}
            onStop={handleStopSearch}
            loading={loading}
            placeholder="Search..."
          />
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-20">{renderContent()}</main>

      {/* Comparison Floating Bar */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-6 fade-in duration-300">
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] shadow-2xl rounded-full px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Scale size={18} className="text-[var(--app-primary)]" />
              <span>{compareList.length} Selected</span>
            </div>
            <div className="h-6 w-[1px] bg-[var(--app-border)]"></div>
            <button onClick={runComparison} disabled={compareList.length < 2} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${compareList.length >= 2 ? 'bg-[var(--app-primary)] text-white hover:opacity-90' : 'bg-[var(--app-bg)] text-[var(--app-text-muted)] cursor-not-allowed'}`}>
              <Sparkles size={14} /> Compare Selected
            </button>
            <button onClick={clearCompare} className="p-1 hover:bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><X size={16} /></button>
          </div>
        </div>
      )}

      <ScriptDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSwitchToUpgrade={() => setMode('upgrade')}
        onDeepScan={() => { setMode('upgrade'); setPackages([]); }}
      />

      <ChatInterface
        onShowResults={(res) => { setMode('install'); setPackages(res); setSearched(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        pendingMessage={pendingChatQuery}
        onClearPendingMessage={() => setPendingChatQuery('')}
      />
    </div>
  );
}

export default App;
