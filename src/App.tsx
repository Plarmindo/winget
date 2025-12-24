import { useState, useEffect } from 'react';
import { AppMode, WingetPackage } from './types';
import { parseWingetOutput, generateAppDetailsPrompt, generateComparisonPrompt, generateAIResponse } from './services/wingetService';
import { isTauri, openUrl } from './services/tauriBridge';
import { STORAGE_KEYS, DEFAULT_THEMES } from './constants';
import { useAppStore } from './stores/store';
import { usePackageOperations } from './hooks/usePackageOperations';
import { useSearchLogic } from './hooks/useSearchLogic';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { logger } from './utils/logger';

// Components
import { HistoryModal } from './components/HistoryModal';
import { ScriptDrawer } from './components/ScriptDrawer';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { Navbar } from './components/Navbar';
import { SearchInput } from './components/SearchInput';
import { CompareModal } from './components/CompareModal';
import { HelpModal } from './components/HelpModal';
import { ProgressBar } from './components/ProgressBar';
import { StatusBar } from './components/StatusBar';
import ErrorBoundary from './components/ErrorBoundary';

// New extracted components
import { ModeNavigation } from './components/layout/ModeNavigation';
import { CompareBar } from './components/CompareBar';
import { ContentArea } from './components/ContentArea';

function App() {
  // Global Store
  const {
    settings,
    mode, setMode,
    query, setQuery,
    packages, setPackages,
    loading, setLoading,
    error, setError,
    clearCart,
    compareList, clearCompare,
    pendingChatQuery, setPendingChatQuery
  } = useAppStore();

  // Custom Hooks
  const { executeOperation, CloneDialogComponent, handleDirectInstall } = usePackageOperations();
  const { handleSearch, handleStopSearch, searched, setSearched, setHasMore, storePackagesForFiltering } = useSearchLogic();

  // Keyboard Shortcuts
  useKeyboardShortcuts([
    { key: 'k', ctrl: true, handler: () => {/* TODO: Open command palette */ }, description: 'Open command palette' },
    { key: '1', ctrl: true, handler: () => setMode('install'), description: 'Switch to Install' },
    { key: '2', ctrl: true, handler: () => setMode('upgrade'), description: 'Switch to Upgrade' },
    { key: '3', ctrl: true, handler: () => setMode('uninstall'), description: 'Switch to Uninstall' },
    { key: '4', ctrl: true, handler: () => setMode('github'), description: 'Switch to GitHub' },
    {
      key: 'f', ctrl: true, handler: () => {
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
      }, description: 'Focus search'
    },
    { key: 'c', ctrl: true, shift: true, handler: () => setIsDrawerOpen(true), description: 'Open cart' },
    { key: ',', ctrl: true, handler: () => setIsSettingsOpen(true), description: 'Open settings' },
    { key: '/', ctrl: true, handler: () => setIsHelpOpen(true), description: 'Open help' },
    {
      key: 'Escape', handler: () => {
        if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isHelpOpen) setIsHelpOpen(false);
        else if (isDrawerOpen) setIsDrawerOpen(false);
        else if (isCompareModalOpen) setIsCompareModalOpen(false);
        else if (isHistoryOpen) setIsHistoryOpen(false);
      }, description: 'Close modal'
    },
    { key: 'h', ctrl: true, handler: () => setIsHistoryOpen(true), description: 'Installation history' },
  ]);

  // Local UI State (Modals)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Import State
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Desktop State
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isTauri());

    // Load Secure API Config
    const loadConfig = async () => {
      try {
        // Dynamic import to avoid issues in pure web mode if not handled by bundler
        const { loadApiConfig } = await import('./services/tauriBridge');
        const config = await loadApiConfig();
        logger.debug('Loaded Secure Config', config);

        if (config) {
          // Only update if we have meaningful data, or if we want to enforce defaults
          // If provider is empty string, it might be a glitch, so fallback to existing or gemini
          const currentSettings = useAppStore.getState().settings;
          const newProvider = (config.provider && config.provider.trim() !== '') ? config.provider : currentSettings.aiConfig.provider;

          useAppStore.getState().updateSettings({
            aiConfig: {
              provider: newProvider as any,
              apiKey: config.api_key, // API Key can be empty (Ollama)
              baseUrl: config.base_url || (newProvider === 'ollama' ? 'http://localhost:11434/v1' : ''),
              modelId: config.model_id || 'gemini-2.5-flash'
            }
          });
          useAppStore.getState().setStatusMessage("AI Configuration Loaded & Secure", "success");
          setTimeout(() => useAppStore.getState().setStatusMessage(null), 4000);
        }
      } catch (e) {
        logger.error('Failed to load secure config', e);
      }
    };
    loadConfig();
  }, []);

  // Enforce valid provider for Web Mode - DISABLED per user request
  // Windows providers are now allowed in Web Mode
  /* 
     Logic removed to allow full provider selection in Web Mode 
  */

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

  // Reset on Mode Change + Auto-load for Desktop Mode
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

    // Auto-load packages for Desktop mode
    const autoLoad = async () => {
      if (!isDesktop) return; // Only in Desktop mode

      if (mode === 'upgrade') {
        setLoading(true);
        try {
          const { listUpgradablePackages } = await import('./services/wingetService');
          const upgradablePackages = await listUpgradablePackages();
          setPackages(upgradablePackages);
          storePackagesForFiltering(upgradablePackages);
          setSearched(true);
        } catch (e: any) {
          setError(e instanceof Error ? e.message : e);
        } finally {
          setLoading(false);
        }
      } else if (mode === 'uninstall') {
        setLoading(true);
        try {
          const { listInstalledPackages } = await import('./services/wingetService');
          const installedPackages = await listInstalledPackages();
          setPackages(installedPackages);
          storePackagesForFiltering(installedPackages);
          setSearched(true);
        } catch (e: any) {
          setError(e instanceof Error ? e.message : e);
        } finally {
          setLoading(false);
        }
      }
    };

    autoLoad();
  }, [mode, isDesktop]);

  // Re-search when Package Manager changes
  useEffect(() => {
    if (query && searched) {
      handleSearch(query);
    } else {
      setPackages([]);
      setSearched(false);
    }
  }, [settings.activePackageManager]);

  const handleClearData = (type: 'cart' | 'chat' | 'all') => {
    if (type === 'cart' || type === 'all') clearCart();
    if (type === 'chat' || type === 'all') { localStorage.removeItem(STORAGE_KEYS.CHAT); window.location.reload(); }
    if (type === 'all') { useAppStore.persist.clearStorage(); window.location.reload(); }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    setImportError(null); setError(null);
    setTimeout(() => {
      try {
        const parsed = parseWingetOutput(importText);
        if (parsed.length === 0) { setImportError("No packages found."); setPackages([]); }
        else { setPackages(parsed); setSearched(true); setImportText(''); }
      } catch { setImportError("Parsing error."); }
    }, 500);
  };

  const runComparison = async () => {
    if (compareList.length < 2) return;
    setIsCompareModalOpen(true);
    setIsComparing(true);
    setCompareResult(null);

    try {
      setLoading(true);
      const prompt = generateComparisonPrompt(compareList);
      const result = await generateAIResponse(settings, prompt, "You are a software comparison expert. Provide detailed, unbiased comparisons in JSON format matching the requested schema.", true);
      setCompareResult(result);
    } catch (e: any) {
      console.error("Comparison failed:", e);
      setCompareResult(`Failed to generate comparison: ${e.message || "Unknown error"}. Please check AI settings.`);
    } finally {
      setIsComparing(false);
      setLoading(false);
    }
  };

  const handleFetchAiDetails = async (pkg: WingetPackage): Promise<string> => {
    const basePrompt = generateAppDetailsPrompt(pkg.name, pkg.id);
    const prompt = `${basePrompt} \nConstraint: Keep the response under 80 words.Focus on key features.`;
    return await generateAIResponse(settings, prompt, "You are a helpful software assistant.", false);
  };

  const handleDirectExecution = (id: string, currentMode: AppMode) => {
    executeOperation(id, currentMode);
  };

  const handleGitHubAction = (id: string, action: import('./types').GitHubAction) => {
    const [owner, repo] = id.split('/');
    // Check if id is already a URL or just owner/repo
    const url = id.startsWith('http') ? id : `https://github.com/${owner}/${repo}`;

    switch (action) {
      case 'open':
      case 'star':
      case 'unstar':
      case 'watch':
      case 'unwatch':
      case 'fork':
      case 'details':
        openUrl(url).catch(console.error);
        break;
      case 'clone':
        // Ensure we treat this as an install operation (which handles cloning for github)
        // We might need to handle the case where activePackageManager is NOT github
        // But usePackageOperations checks settings.activePackageManager.
        // For now, assume the user is in a context where cloning is appropriate or force it?
        // Actually, executeOperation checks settings.activePackageManager. 
        // If we want to force clone, we might need a specific/direct clone function.
        // But let's try calling executeOperation with 'install' for now.
        executeOperation(id, 'install');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col font-sans relative transition-colors duration-300">
      <ProgressBar />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearData={handleClearData}
      />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} onOpenSettings={() => setIsSettingsOpen(true)} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
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

      <ModeNavigation mode={mode} setMode={setMode} />

      {/* Search Bar (Mobile) - Visible in all modes */}
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



      <main className="flex-1 max-w-[1920px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-20">
        <ContentArea
          packages={packages}
          mode={mode}
          loading={loading}
          searched={searched}
          query={query}
          error={error}
          isDesktop={isDesktop}
          importText={importText}
          setImportText={setImportText}
          importError={importError}
          handleSearch={handleSearch}
          handleImport={handleImport}
          handleDirectExecution={handleDirectExecution}
          handleFetchAiDetails={handleFetchAiDetails}
          handleDirectInstall={handleDirectInstall}
          handleGitHubAction={handleGitHubAction}
          executeOperation={executeOperation}
          openSettings={() => setIsSettingsOpen(true)}
          setError={setError}
          setPackages={setPackages}
          setSearched={setSearched}
          setQuery={setQuery}
        />
      </main>

      <CompareBar
        compareList={compareList}
        onCompare={runComparison}
        onClear={clearCompare}
      />

      <ScriptDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSwitchToUpgrade={() => setMode('upgrade')}
        onDeepScan={() => { setMode('upgrade'); setPackages([]); }}
      />


      <ErrorBoundary>
        <ChatInterface
          onShowResults={(res) => { setMode('install'); setPackages(res); setSearched(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          pendingMessage={pendingChatQuery}
          onClearPendingMessage={() => setPendingChatQuery('')}
        />
      </ErrorBoundary>


      <StatusBar />

      {/* Clone Dialog */}
      {CloneDialogComponent}
    </div>
  );
}

export default App;
