import { useState, useEffect } from 'react';
import { WingetPackage } from './types';
import { generateAppDetailsPrompt, generateAIResponse } from './services/wingetService';
import { openUrl } from './services/tauriBridge';
import { useAppStore } from './stores/store';
import { usePackageOperations } from './hooks/usePackageOperations';
import { useSearchLogic } from './hooks/useSearchLogic';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useThemeSync } from './hooks/useThemeSync';
import { useAppController } from './hooks/useAppController';

// Components
import { HistoryModal } from './components/HistoryModal';
import { ScriptDrawer } from './components/ScriptDrawer';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { Navbar } from './components/Navbar';
import { CompareModal } from './components/CompareModal';
import { HelpModal } from './components/HelpModal';
import { ProgressBar } from './components/ProgressBar';
import { StatusBar } from './components/StatusBar';
import ErrorBoundary from './components/ErrorBoundary';
import { OnboardingModal } from './components/OnboardingModal';
import { ModeNavigation } from './components/layout/ModeNavigation';
import { CompareBar } from './components/CompareBar';
import { ContentArea } from './components/ContentArea';

function App() {
  const settings = useAppStore(s => s.settings);
  const mode = useAppStore(s => s.mode);
  const setMode = useAppStore(s => s.setMode);
  const query = useAppStore(s => s.query);
  const setQuery = useAppStore(s => s.setQuery);
  const packages = useAppStore(s => s.packages);
  const setPackages = useAppStore(s => s.setPackages);
  const loading = useAppStore(s => s.loading);
  const setLoading = useAppStore(s => s.setLoading);
  const error = useAppStore(s => s.error);
  const setError = useAppStore(s => s.setError);
  const compareList = useAppStore(s => s.compareList);
  const clearCompare = useAppStore(s => s.clearCompare);
  const pendingChatQuery = useAppStore(s => s.pendingChatQuery);
  const setPendingChatQuery = useAppStore(s => s.setPendingChatQuery);

  const { executeOperation, CloneDialogComponent, handleDirectInstall } = usePackageOperations();
  const { handleSearch, handleStopSearch, searched, setSearched, setHasMore, storePackagesForFiltering } = useSearchLogic();

  const {
    isDesktop,
    showOnboarding, setShowOnboarding,
    isComparing,
    compareResult,
    refreshPackages,
    handleClearData,
    handleImport,
    runComparison
  } = useAppController(handleSearch, handleStopSearch, storePackagesForFiltering);

  // Modals Local State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  useThemeSync(settings);

  useKeyboardShortcuts([
    { key: '1', ctrl: true, handler: () => setMode('install'), description: 'Switch to Install' },
    { key: '2', ctrl: true, handler: () => setMode('upgrade'), description: 'Switch to Upgrade' },
    { key: '3', ctrl: true, handler: () => setMode('uninstall'), description: 'Switch to Uninstall' },
    { key: '4', ctrl: true, handler: () => setMode('github'), description: 'Switch to GitHub' },
    { key: ',', ctrl: true, handler: () => setActiveModal('settings'), description: 'Open settings' },
    { key: '/', ctrl: true, handler: () => setActiveModal('help'), description: 'Open help' },
    { key: 'h', ctrl: true, handler: () => setActiveModal('history'), description: 'Installation history' },
    { key: 'Escape', handler: () => setActiveModal(null), description: 'Close modal' },
  ]);

  // Reset logic when mode or environment changes
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
    refreshPackages();
    // We only want this to run when the mode or desktop status actually changes.
    // Including all setters and refreshPackages in the dependency array
    // causes infinite loops because refreshPackages depends on query, 
    // and we call setQuery('') here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isDesktop]);

  const handleFetchAiDetails = async (pkg: WingetPackage): Promise<string> => {
    const prompt = `${generateAppDetailsPrompt(pkg.name, pkg.id)} \nConstraint: Keep the response under 80 words.`;
    return await generateAIResponse(settings, prompt, "You are a helpful software assistant.", false);
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col font-sans relative transition-colors duration-300">
      <ProgressBar />

      <SettingsModal isOpen={activeModal === 'settings'} onClose={() => setActiveModal(null)} onClearData={handleClearData} />
      <HelpModal isOpen={activeModal === 'help'} onClose={() => setActiveModal(null)} onOpenSettings={() => setActiveModal('settings')} />
      <HistoryModal isOpen={activeModal === 'history'} onClose={() => setActiveModal(null)} />
      <CompareModal isOpen={activeModal === 'compare'} onClose={() => setActiveModal(null)} result={compareResult} isLoading={isComparing} />
      {showOnboarding && <OnboardingModal onClose={() => { setShowOnboarding(false); localStorage.setItem('onboarding_seen', 'true'); }} />}

      <Navbar
        handleSearch={handleSearch}
        stopSearch={handleStopSearch}
        openDrawer={() => setActiveModal('cart')}
        openSettings={() => setActiveModal('settings')}
        openHelp={() => setActiveModal('help')}
        resetState={() => { setMode('install'); window.location.reload(); }}
        onRefresh={refreshPackages}
        isDesktop={isDesktop}
      />

      <ModeNavigation mode={mode} setMode={setMode} />

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
          handleImport={() => handleImport(importText, setImportText, setImportError)}
          handleDirectExecution={(id, m) => executeOperation(id, m)}
          handleFetchAiDetails={handleFetchAiDetails}
          handleDirectInstall={handleDirectInstall}
          handleGitHubAction={(id, action) => {
            const baseUrl = id.startsWith('http') ? id : `https://github.com/${id}`;
            console.log('[GitHub Action]', { id, action, baseUrl });

            switch (action) {
              case 'clone':
                executeOperation(id, 'install');
                break;
              case 'open':
              case 'star':
              case 'fork':
              case 'watch':
              case 'details':
                // All these actions open the GitHub page
                openUrl(baseUrl);
                break;
              default:
                console.warn('Unknown GitHub action:', action);
                openUrl(baseUrl);
            }
          }}
          executeOperation={executeOperation}
          openSettings={() => setActiveModal('settings')}
          setError={setError}
          setPackages={setPackages}
          setSearched={setSearched}
          setQuery={setQuery}
        />
      </main>

      <CompareBar compareList={compareList} onCompare={() => { setActiveModal('compare'); runComparison(); }} onClear={clearCompare} />

      <ScriptDrawer isOpen={activeModal === 'cart'} onClose={() => setActiveModal(null)} onSwitchToUpgrade={() => setMode('upgrade')} onDeepScan={() => { setMode('upgrade'); setPackages([]); }} />

      <ErrorBoundary>
        <ChatInterface
          onShowResults={(res) => { setMode('install'); setPackages(res); setSearched(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          pendingMessage={pendingChatQuery}
          onClearPendingMessage={() => setPendingChatQuery('')}
        />
      </ErrorBoundary>

      <StatusBar />
      {CloneDialogComponent}
    </div>
  );
}

export default App;
