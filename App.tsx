
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, RefreshCw, Trash2, RotateCcw, Settings, Filter, Download, Search as SearchIcon, Scale, X, Sparkles } from 'lucide-react';
import { WingetPackage, AppMode, AppSettings, PackageManagerType } from './types';
import { searchPackages, parseWingetOutput, generateAppDetailsPrompt, generateAlternativesPrompt, generateEvaluationPrompt, generateComparisonPrompt, generateAIResponse } from './services/wingetService';
import { PRESET_CATEGORIES, DEFAULT_THEMES, STORAGE_KEYS } from './constants';
import { getErrorDetails } from './utils/errorUtils';

// Components
import { PackageGrid } from './components/PackageGrid';
import { ScriptDrawer } from './components/ScriptDrawer';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { Navbar } from './components/Navbar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MaintenanceImport } from './components/MaintenanceImport';
import { SearchInput } from './components/SearchInput';
import { CompareModal } from './components/CompareModal';
import { HelpModal } from './components/HelpModal';

function App() {
  const [query, setQuery] = useState('');
  const [packages, setPackages] = useState<WingetPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = { 
      reducedMotion: false, 
      highContrast: false, 
      compactMode: false, 
      defaultModel: 'smart',
      activeThemeId: 'default', 
      themes: DEFAULT_THEMES, 
      customSubjects: ['Browsers', 'Communication', 'Dev Tools'], 
      itemsPerPage: 9,
      activePackageManager: 'winget', 
      aiConfig: { provider: 'gemini', apiKey: '', baseUrl: '', modelId: 'gemini-2.5-flash' }
    };

    if (typeof window !== 'undefined') {
       const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
       if (saved) { 
          try { 
            const parsed = JSON.parse(saved);
            // Deep merge logic to ensure new fields (like aiConfig) exist even if localStorage has old data
            return {
              ...defaultSettings,
              ...parsed,
              themes: parsed.themes || defaultSettings.themes,
              // Ensure aiConfig exists
              aiConfig: { ...defaultSettings.aiConfig, ...(parsed.aiConfig || {}) }
            };
          } catch(e) {
            console.error("Failed to load settings", e);
          } 
       }
    }
    return defaultSettings;
  });

  // Comparison State
  const [compareList, setCompareList] = useState<WingetPackage[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [compareResult, setCompareResult] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Apply Theme
  useEffect(() => {
    const activeTheme = settings.themes.find(t => t.id === settings.activeThemeId) || DEFAULT_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--app-bg', activeTheme.colors.bg);
    root.style.setProperty('--app-surface', activeTheme.colors.surface);
    root.style.setProperty('--app-border', activeTheme.colors.border);
    root.style.setProperty('--app-text', activeTheme.colors.text);
    root.style.setProperty('--app-text-muted', activeTheme.colors.textMuted);
    root.style.setProperty('--app-primary', activeTheme.colors.primary);
    root.style.setProperty('--app-primary-hover', activeTheme.colors.primaryHover);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const [cart, setCart] = useState<WingetPackage[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEYS.CART);
      try { return saved ? JSON.parse(saved) : []; } catch (e) {}
    }
    return [];
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mode, setMode] = useState<AppMode>('install');
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [chatResetKey, setChatResetKey] = useState(0);
  const [pendingChatQuery, setPendingChatQuery] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    setPackages([]); setSearched(false); setCurrentPage(1); setQuery(''); setImportText(''); 
    setImportError(null); setError(null); setHasMore(true); setCategoryFilter('All');
    setLoading(false); abortControllerRef.current?.abort();
    setCompareList([]); // Clear comparison on mode change
  }, [mode]);

  const handleStopSearch = () => { abortControllerRef.current?.abort(); setLoading(false); };
  
  const handleClearData = (type: 'cart' | 'chat' | 'all') => {
    if (type === 'cart' || type === 'all') setCart([]);
    if (type === 'chat' || type === 'all') { localStorage.removeItem(STORAGE_KEYS.CHAT); setChatResetKey(p => p + 1); }
    if (type === 'all') { localStorage.removeItem(STORAGE_KEYS.SETTINGS); window.location.reload(); }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() && searchQuery !== "POPULAR_ESSENTIALS") return;
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;
    setLoading(true); setSearched(true); setError(null); setCurrentPage(1); setHasMore(true); 
    setPackages([]); setCategoryFilter('All');
    setQuery(searchQuery === "POPULAR_ESSENTIALS" ? "" : searchQuery);
    try {
      const results = await searchPackages(searchQuery, [], settings, ac.signal);
      setPackages(results); if (results.length < 12) setHasMore(false);
    } catch (error: any) {
      if (error.name !== 'AbortError') setError(error.message || "Failed to search.");
    } finally { if (!ac.signal.aborted) setLoading(false); }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    setIsImporting(true); setImportError(null); setError(null);
    setTimeout(() => {
      try {
        const parsed = parseWingetOutput(importText);
        if (parsed.length === 0) { setImportError("No packages found."); setPackages([]); }
        else { setPackages(parsed); setSearched(true); setImportText(''); setCurrentPage(1); }
      } catch { setImportError("Parsing error."); } finally { setIsImporting(false); }
    }, 500);
  };

  const toggleCart = (pkg: WingetPackage) => {
    setCart(prev => prev.find(i => i.id === pkg.id) ? prev.filter(i => i.id !== pkg.id) : [...prev, pkg]);
  };

  const toggleCompare = (pkg: WingetPackage) => {
     setCompareList(prev => prev.find(i => i.id === pkg.id) ? prev.filter(i => i.id !== pkg.id) : [...prev, pkg]);
  };

  const runComparison = async () => {
     if (compareList.length < 2) return;
     setIsCompareModalOpen(true);
     setIsComparing(true);
     setCompareResult(null);

     try {
       const prompt = generateComparisonPrompt(compareList);
       // Pass a custom system instruction just for this one-off request
       const result = await generateAIResponse(settings, prompt, "You are a software comparison expert. Provide detailed, unbiased comparisons in markdown format.");
       setCompareResult(result);
     } catch (e) {
       setCompareResult("Failed to generate comparison. Please check AI settings.");
     } finally {
       setIsComparing(false);
     }
  };
  
  const copySingleCommand = (id: string, currentMode: AppMode) => {
    const pm = settings.activePackageManager;
    let cmd = pm === 'winget' ? `winget ${currentMode === 'uninstall' ? 'uninstall' : currentMode} ${id} -e` : `${pm} ${currentMode} ${id}`;
    navigator.clipboard.writeText(cmd);
  };

  const filteredPackages = categoryFilter === 'All' ? packages : packages.filter(p => (p.category || 'Other') === categoryFilter);

  const renderContent = () => {
    if (loading || isImporting) return <div className="flex flex-col items-center justify-center h-64"><Loader2 className="animate-spin mb-4 text-[var(--app-primary)]" size={48} /><p className="text-[var(--app-text-muted)]">{isImporting ? 'Parsing...' : 'Querying database...'}</p><button onClick={handleStopSearch} className="mt-6 px-4 py-2 border rounded-full text-xs">Stop</button></div>;
    
    if (error) {
       const err = getErrorDetails(error);
       return <div className="flex flex-col items-center text-center py-12 px-4"><div className="p-4 bg-red-500/10 rounded-full text-red-500 mb-4">{err.icon}</div><h3 className="text-xl font-bold mb-2">{err.title}</h3><p className="text-[var(--app-text-muted)] max-w-md mb-8">{err.description}</p><div className="flex gap-3">{err.action === 'retry' && <button onClick={() => handleSearch(query)} className="px-6 py-2 bg-[var(--app-primary)] text-white rounded-full text-sm font-bold flex gap-2"><RotateCcw size={16}/>Retry</button>}<button onClick={() => setIsSettingsOpen(true)} className="px-6 py-2 border rounded-full text-sm font-medium flex gap-2"><Settings size={16}/>Settings</button></div></div>;
    }

    if (mode === 'install') {
      if (!searched && packages.length === 0) return <WelcomeScreen settings={settings} setMode={(m) => setMode(m)} handleSearch={handleSearch} openSettings={() => setIsSettingsOpen(true)} />;
      
      return (
        <>
          <div className="flex flex-wrap gap-2 mb-8">
            <button onClick={() => handleSearch("POPULAR_ESSENTIALS")} className="px-4 py-1.5 rounded-full text-xs font-medium border bg-[var(--app-primary)]/10 text-[var(--app-primary)] border-[var(--app-primary)]/30">Essentials</button>
            {PRESET_CATEGORIES.map(cat => <button key={cat} onClick={() => handleSearch(cat.toLowerCase())} className="px-4 py-1.5 rounded-full text-xs font-medium bg-[var(--app-surface)] text-[var(--app-text-muted)] border border-[var(--app-border)] hover:bg-[var(--app-border)] hover:text-[var(--app-text)]">{cat}</button>)}
          </div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">{searched ? (query ? `Results for "${query}"` : 'Recommended') : 'Popular'}</h2>
            {packages.length > 0 && <div className="flex items-center gap-3"><div className="relative"><select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }} className="appearance-none bg-[var(--app-surface)] border border-[var(--app-border)] text-xs rounded-lg pl-3 pr-8 py-2"><option value="All">All ({packages.length})</option>{Array.from(new Set(packages.map(p => p.category || 'Other'))).sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><Filter size={14} className="absolute right-2.5 top-2.5 pointer-events-none text-[var(--app-text-muted)]" /></div></div>}
          </div>
          {filteredPackages.length === 0 && <div className="text-center py-12 text-[var(--app-text-muted)]">No packages found.</div>}
          
          <PackageGrid packages={filteredPackages} cart={cart} onToggleCart={toggleCart} onCopyCommand={copySingleCommand} setPendingChatQuery={(q) => setPendingChatQuery(q)} handleSearch={handleSearch} setMode={(m) => setMode(m)} mode={mode} settings={settings} currentPage={currentPage} setCurrentPage={(p) => setCurrentPage(p)} compareList={compareList} onToggleCompare={toggleCompare} />
        </>
      );
    }

    if (packages.length === 0) return <MaintenanceImport mode={mode} settings={settings} importText={importText} setImportText={(t) => setImportText(t)} importError={importError} handleImport={handleImport} />;

    return (
       <>
          <div className="flex justify-between mb-6"><h2 className="text-2xl font-bold">Detected Software ({packages.length})</h2><button onClick={() => { setPackages([]); setImportText(''); }} className="text-sm underline">Parse New List</button></div>
          <PackageGrid packages={filteredPackages} cart={cart} onToggleCart={toggleCart} onCopyCommand={copySingleCommand} setPendingChatQuery={(q) => setPendingChatQuery(q)} handleSearch={handleSearch} setMode={(m) => setMode(m)} mode={mode} settings={settings} currentPage={currentPage} setCurrentPage={(p) => setCurrentPage(p)} compareList={compareList} onToggleCompare={toggleCompare} />
       </>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)] flex flex-col font-sans relative transition-colors duration-300">
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onUpdateSettings={(s) => setSettings(s)} 
        onClearData={handleClearData} 
      />
      <HelpModal 
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
      <CompareModal 
         isOpen={isCompareModalOpen}
         onClose={() => setIsCompareModalOpen(false)}
         result={compareResult}
         isLoading={isComparing}
      />
      <Navbar 
        settings={settings} 
        setSettings={(s) => setSettings(s)} 
        mode={mode} 
        setMode={(m) => setMode(m)} 
        query={query} 
        setQuery={(q) => setQuery(q)} 
        handleSearch={handleSearch} 
        loading={loading} 
        stopSearch={handleStopSearch} 
        cartCount={cart.length} 
        openDrawer={() => setIsDrawerOpen(true)} 
        openSettings={() => setIsSettingsOpen(true)} 
        openHelp={() => setIsHelpOpen(true)}
        onClearCart={() => { if(window.confirm('Are you sure you want to clear your cart?')) setCart([]); }}
        resetState={() => { setMode('install'); setSearched(false); setPackages([]); setQuery(''); setError(null); }} 
      />
      <div className="bg-[var(--app-surface)] border-b border-[var(--app-border)] py-2"><div className="max-w-7xl mx-auto px-4 flex gap-1 justify-center sm:justify-start">
        {['install', 'upgrade', 'uninstall'].map(m => <button key={m} onClick={() => setMode(m as AppMode)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? (m === 'upgrade' ? 'bg-emerald-600 text-white' : m === 'uninstall' ? 'bg-red-600 text-white' : 'bg-[var(--app-primary)] text-white') : 'text-[var(--app-text-muted)] hover:bg-[var(--app-bg)]'}`}>{m === 'install' ? <Download size={16}/> : m === 'upgrade' ? <RefreshCw size={16}/> : <Trash2 size={16}/>} <span className="capitalize">{m}</span></button>)}
      </div></div>
      {mode === 'install' && (
        <div className="md:hidden p-4 border-b border-[var(--app-border)] bg-[var(--app-surface)]/50">
          <SearchInput 
             value={query} 
             onChange={(val) => setQuery(val)}
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
               <button 
                 onClick={runComparison}
                 disabled={compareList.length < 2}
                 className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${compareList.length >= 2 ? 'bg-[var(--app-primary)] text-white hover:opacity-90' : 'bg-[var(--app-bg)] text-[var(--app-text-muted)] cursor-not-allowed'}`}
               >
                 <Sparkles size={14} /> Compare with AI
               </button>
               <button onClick={() => setCompareList([])} className="p-1 hover:bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors">
                  <X size={16} />
               </button>
            </div>
         </div>
      )}

      <ScriptDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} cart={cart} onRemove={(id) => setCart(p => p.filter(x => x.id !== id))} onClear={() => setCart([])} mode={mode} packageManager={settings.activePackageManager} onSwitchToUpgrade={() => setMode('upgrade')} onDeepScan={() => { setMode('upgrade'); setPackages([]); }} />
      <ChatInterface key={chatResetKey} onShowResults={(res) => { setMode('install'); setPackages(res); setSearched(true); setCurrentPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} pendingMessage={pendingChatQuery} onClearPendingMessage={() => setPendingChatQuery('')} defaultModel={settings.defaultModel} settings={settings} />
    </div>
  );
}

export default App;
