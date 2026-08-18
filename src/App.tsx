import { useState, useEffect, lazy, Suspense } from 'react';
import { WingetPackage } from './types';
import { generateAppDetailsPrompt, generateAIResponse } from './services/wingetService';
import { openUrl } from './services/tauriBridge';
import { useAppStore } from './stores/store';
import { usePackageOperations } from './hooks/usePackageOperations';
import { useSearchLogic } from './hooks/useSearchLogic';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useThemeSync } from './hooks/useThemeSync';
import { useAppController } from './hooks/useAppController';
import { STORAGE_KEYS } from './constants';
import { logger } from './utils/logger';

// Components - eagerly loaded (always visible)
import { HistoryModal } from './components/HistoryModal';
import type { SettingsTab } from './components/SettingsModal';
import { ScriptDrawer } from './components/ScriptDrawer';
import { Navbar } from './components/Navbar';
import { ProgressBar } from './components/ProgressBar';
import { StatusBar } from './components/StatusBar';
import ErrorBoundary from './components/ErrorBoundary';
import { ModeNavigation } from './components/layout/ModeNavigation';
import { CompareBar } from './components/CompareBar';
import { ContentArea } from './components/ContentArea';
import { Toaster } from './components/Toaster';
import { ConfirmDialog } from './components/ConfirmDialog';

// Heavy components - lazy loaded
const ChatInterface = lazy(() => import('./components/ChatInterface').then((m) => ({ default: m.ChatInterface })));
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const CompareModal = lazy(() => import('./components/CompareModal').then((m) => ({ default: m.CompareModal })));
const HelpModal = lazy(() => import('./components/HelpModal').then((m) => ({ default: m.HelpModal })));
const OnboardingModal = lazy(() =>
  import('./components/OnboardingModal').then((m) => ({ default: m.OnboardingModal }))
);

function App() {
  const settings = useAppStore((s) => s.settings);
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const packages = useAppStore((s) => s.packages);
  const setPackages = useAppStore((s) => s.setPackages);
  const loading = useAppStore((s) => s.loading);
  const setLoading = useAppStore((s) => s.setLoading);
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);
  const compareList = useAppStore((s) => s.compareList);
  const clearCompare = useAppStore((s) => s.clearCompare);
  const pendingChatQuery = useAppStore((s) => s.pendingChatQuery);
  const setPendingChatQuery = useAppStore((s) => s.setPendingChatQuery);

  // Sync mode with provider: GitHub tab → github provider, other tabs → non-github provider
  // Also fix stale persisted state where activePackageManager is 'github' but mode is not
  useEffect(() => {
    if (mode !== 'github' && settings.activePackageManager === 'github') {
      updateSettings({ activePackageManager: 'winget' });
    }
  }, [mode, settings.activePackageManager, updateSettings]);

  const handleModeChange = (newMode: typeof mode) => {
    const currentProvider = settings.activePackageManager;
    if (newMode === 'github' && currentProvider !== 'github') {
      updateSettings({ activePackageManager: 'github' });
    } else if (newMode !== 'github' && currentProvider === 'github') {
      updateSettings({ activePackageManager: 'winget' });
    }
    setMode(newMode);
  };

  const { executeOperation, CloneDialogComponent, handleDirectInstall } = usePackageOperations();
  const { handleSearch, handleStopSearch, searched, setSearched, setHasMore, storePackagesForFiltering } =
    useSearchLogic();

  const {
    isDesktop,
    showOnboarding,
    setShowOnboarding,
    isComparing,
    compareResult,
    refreshPackages,
    handleClearData,
    handleImport,
    runComparison,
  } = useAppController(handleSearch, handleStopSearch, storePackagesForFiltering);

  // Modals Local State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('general');
  // True only for deep-link opens (an explicit tab was requested), so Settings
  // can auto-focus the AI tab's primary field. Generic opens (navbar, Ctrl+,
  // help) keep it false so browsing settings never yanks focus.
  const [settingsFocusOnOpen, setSettingsFocusOnOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const SETTINGS_TABS: SettingsTab[] = ['general', 'ai', 'connections', 'data', 'about'];

  const readLastSettingsTab = (): SettingsTab => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS_TAB);
    return SETTINGS_TABS.includes(saved as SettingsTab) ? (saved as SettingsTab) : 'general';
  };

  // Remember where the user left off in Settings, so the navbar reopens on the
  // same tab. Deep links pass an explicit tab and override the remembered one.
  const openSettings = (tab?: SettingsTab) => {
    setSettingsFocusOnOpen(tab !== undefined);
    setSettingsInitialTab(tab ?? readLastSettingsTab());
    setActiveModal('settings');
  };

  useThemeSync(settings);

  useKeyboardShortcuts([
    { key: '1', ctrl: true, handler: () => handleModeChange('install'), description: 'Switch to Install' },
    { key: '2', ctrl: true, handler: () => handleModeChange('upgrade'), description: 'Switch to Upgrade' },
    { key: '3', ctrl: true, handler: () => handleModeChange('uninstall'), description: 'Switch to Uninstall' },
    { key: '4', ctrl: true, handler: () => handleModeChange('github'), description: 'Switch to GitHub' },
    { key: ',', ctrl: true, handler: () => openSettings(), description: 'Open settings' },
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
    return await generateAIResponse(settings, prompt, 'You are a helpful software assistant.');
  };

  return (
    <div
      className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col font-sans relative transition-colors duration-300"
      data-testid="app-container"
    >
      <ProgressBar />

      <Suspense fallback={null}>
        <SettingsModal
          isOpen={activeModal === 'settings'}
          onClose={() => setActiveModal(null)}
          onClearData={handleClearData}
          initialTab={settingsInitialTab}
          focusOnOpen={settingsFocusOnOpen}
          onTabChange={(tab) => localStorage.setItem(STORAGE_KEYS.SETTINGS_TAB, tab)}
        />
      </Suspense>
      <Suspense fallback={null}>
        <HelpModal
          isOpen={activeModal === 'help'}
          onClose={() => setActiveModal(null)}
          onOpenSettings={() => openSettings()}
        />
      </Suspense>
      <HistoryModal isOpen={activeModal === 'history'} onClose={() => setActiveModal(null)} />
      <Suspense fallback={null}>
        <CompareModal
          isOpen={activeModal === 'compare'}
          onClose={() => setActiveModal(null)}
          result={compareResult}
          isLoading={isComparing}
        />
      </Suspense>
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingModal
            onClose={() => {
              setShowOnboarding(false);
              localStorage.setItem('onboarding_seen', 'true');
            }}
          />
        </Suspense>
      )}

      <Navbar
        handleSearch={handleSearch}
        stopSearch={handleStopSearch}
        openDrawer={() => setActiveModal('cart')}
        openSettings={() => openSettings()}
        openHelp={() => setActiveModal('help')}
        resetState={() => {
          handleModeChange('install');
          window.location.reload();
        }}
        onRefresh={refreshPackages}
        isDesktop={isDesktop}
      />

      <ModeNavigation mode={mode} setMode={handleModeChange} />

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
            logger.debug('[GitHub Action]', { id, action, baseUrl });

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
          openSettings={() => openSettings('ai')}
          setError={setError}
          setPackages={setPackages}
          setSearched={setSearched}
          setQuery={setQuery}
        />
      </main>

      <CompareBar
        compareList={compareList}
        onCompare={() => {
          setActiveModal('compare');
          runComparison();
        }}
        onClear={clearCompare}
      />

      <ScriptDrawer
        isOpen={activeModal === 'cart'}
        onClose={() => setActiveModal(null)}
        onSwitchToUpgrade={() => handleModeChange('upgrade')}
        onDeepScan={() => {
          handleModeChange('upgrade');
          setPackages([]);
        }}
      />

      <ErrorBoundary>
        <Suspense fallback={<div className="p-4 text-center text-[var(--app-text-muted)]">Loading chat...</div>}>
          <ChatInterface
            onShowResults={(res) => {
              handleModeChange('install');
              setPackages(res);
              setSearched(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            pendingMessage={pendingChatQuery}
            onClearPendingMessage={() => setPendingChatQuery('')}
          />
        </Suspense>
      </ErrorBoundary>

      <StatusBar />
      {CloneDialogComponent}

      {/* Global transient UI: toasts and promise-based confirmations */}
      <Toaster />
      <ConfirmDialog />
    </div>
  );
}

export default App;
