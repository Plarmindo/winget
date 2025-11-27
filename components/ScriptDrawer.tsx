import React, { useState, useEffect } from 'react';
import { WingetPackage, AppMode } from '../types';
import { X, Copy, Trash2, Terminal, CheckCircle2, CheckSquare, Square, Info, AlertTriangle, ArrowDownUp, Search, RefreshCw, ShieldAlert, Database, Check, PieChart, Layers, Download, Loader2, RotateCcw, FileDown } from 'lucide-react';

interface ScriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: WingetPackage[];
  onRemove: (id: string) => void;
  onClear: () => void;
  mode: AppMode;
  onSwitchToUpgrade?: () => void;
  onDeepScan?: () => void;
}

type SortOption = 'name' | 'id' | 'version';
type StatusFilter = 'all' | 'upgradable' | 'installed';

const UNINSTALL_CONFIRMATION_PHRASES = [
  "Select confirmation phrase...",
  "Maybe I should wait.",
  "No, cancel operation.",
  "Yes, uninstall these applications."
];

const CORRECT_UNINSTALL_PHRASE = "Yes, uninstall these applications.";

export const ScriptDrawer: React.FC<ScriptDrawerProps> = ({ isOpen, onClose, cart, onRemove, onClear, mode, onSwitchToUpgrade, onDeepScan }) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Script Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Sorting & Filtering State
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  // Confirmation state for uninstall
  const [selectedConfirmPhrase, setSelectedConfirmPhrase] = useState(UNINSTALL_CONFIRMATION_PHRASES[0]);

  useEffect(() => {
    setSelectedIds(cart.map(p => p.id));
  }, [cart]);

  useEffect(() => {
    setShowConfirmModal(false);
    setShowPreview(false);
    setIsGenerating(false);
    setSelectedConfirmPhrase(UNINSTALL_CONFIRMATION_PHRASES[0]);
    setStatusFilter('all');
  }, [isOpen, mode]);

  useEffect(() => {
    if (isOpen) {
      const savedPrefs = localStorage.getItem('winget_drawer_prefs');
      if (savedPrefs) {
        try {
          const parsed = JSON.parse(savedPrefs);
          setSortBy(parsed.sortBy || 'name');
          setSortAsc(parsed.sortAsc ?? true);
          setStatusFilter(parsed.statusFilter || 'all');
          setCategoryFilter(parsed.categoryFilter || 'All');
        } catch (e) { }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      localStorage.setItem('winget_drawer_prefs', JSON.stringify({
        sortBy, sortAsc, statusFilter, categoryFilter
      }));
    }
  }, [sortBy, sortAsc, statusFilter, categoryFilter, isOpen]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const categories = ['All', ...Array.from(new Set(cart.map(p => p.category || 'Other'))).sort()];

  const getFilteredAndSortedCart = () => {
    let result = [...cart];

    if (statusFilter === 'upgradable') {
      result = result.filter(p => p.availableVersion);
    } else if (statusFilter === 'installed') {
      result = result.filter(p => !p.availableVersion);
    }

    if (categoryFilter !== 'All') {
      result = result.filter(p => (p.category || 'Other') === categoryFilter);
    }

    if (filterText) {
      const lowerText = filterText.toLowerCase();
      result = result.filter(p => 
        (p.name && p.name.toLowerCase().includes(lowerText)) || 
        (p.id && p.id.toLowerCase().includes(lowerText))
      );
    }

    result.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortBy === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (sortBy === 'id') {
        valA = a.id || '';
        valB = b.id || '';
      } else if (sortBy === 'version') {
        valA = a.version || '0';
        valB = b.version || '0';
        return sortAsc 
          ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
          : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
      }

      return sortAsc 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    });

    return result;
  };

  const filteredCart = getFilteredAndSortedCart();

  const toggleAll = () => {
    const visibleIds = filteredCart.map(p => p.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const getExcludedCount = () => {
     if (mode !== 'upgrade') return 0;
     const activePackages = cart.filter(p => selectedIds.includes(p.id));
     const updatable = activePackages.filter(p => p.availableVersion);
     return activePackages.length - updatable.length;
  };
  
  const getSelectionAnalysis = () => {
    const activePackages = cart.filter(p => selectedIds.includes(p.id));
    const upgrades = activePackages.filter(p => p.availableVersion);
    const installs = activePackages.filter(p => !p.availableVersion);
    return { total: activePackages.length, upgrades: upgrades.length, installs: installs.length };
  };
  
  const analysis = getSelectionAnalysis();

  const generateScript = () => {
    const activePackages = cart.filter(p => selectedIds.includes(p.id));
    
    if (activePackages.length === 0) return '# No packages selected for script generation.';
    
    if (mode === 'uninstall') {
      return `# Winget Batch Uninstall Script
# Generated by WinGet Web
#
# PURPOSE: This script will attempt to uninstall the selected applications.
# WARNING: Run this in PowerShell as Administrator.

$packages = @(
${activePackages.map(p => `    "${p.id}"`).join(',\n')}
)

$ErrorActionPreference = "Continue"

foreach ($id in $packages) {
    Write-Host "Processing: $id" -ForegroundColor Cyan
    winget uninstall --id $id -e
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: $id was uninstalled." -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to uninstall $id." -ForegroundColor Red
    }
}
Write-Host "Batch operation complete." -ForegroundColor Yellow`;
    }

    if (mode === 'upgrade') {
        const header = `# Winget Upgrade Script\n# Upgrade existing packages to their latest versions.`;
        const upgradablePackages = activePackages.filter(p => p.availableVersion);
        
        if (upgradablePackages.length === 0) {
           return `${header}\n\n# All selected packages are already up to date or no upgrades found.`;
        }
        
        return `${header}\n\n${upgradablePackages.map(p => `winget upgrade --id ${p.id} -e --source winget`).join('\n')}`;
    }

    if (mode === 'install') {
        const upgrades = activePackages.filter(p => p.availableVersion);
        const installs = activePackages.filter(p => !p.availableVersion);

        let script = `# Winget Install Script\n# Generated by WinGet Web\n`;

        if (upgrades.length > 0) {
            script += `\n# UPDATE: The following packages are detected as installed with updates available.\n# Using 'upgrade' command instead of 'install'.\n`;
            script += upgrades.map(p => `winget upgrade --id ${p.id} -e --source winget`).join('\n');
            script += `\n`;
        }

        if (installs.length > 0) {
            script += `\n# INSTALL: The following packages will be installed.\n`;
            script += installs.map(p => `winget install --id ${p.id} -e --source winget`).join('\n');
        }
        
        return script;
    }

    return `# Unknown mode`;
  };

  const scriptContent = generateScript();
  const excludedCount = getExcludedCount();
  
  const visibleIds = filteredCart.map(p => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isIndeterminate = visibleIds.some(id => selectedIds.includes(id)) && !allVisibleSelected;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([scriptContent], { type: 'text/powershell' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winget-${mode}-script.ps1`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleGenerate = () => {
     setShowConfirmModal(true);
  };

  const confirmGeneration = () => {
     setShowConfirmModal(false);
     setIsGenerating(true);
     setTimeout(() => {
        setIsGenerating(false);
        setShowPreview(true);
     }, 1500);
  };

  const getModeStyles = () => {
    switch (mode) {
      case 'upgrade': return 'bg-emerald-600 text-white';
      case 'uninstall': return 'bg-red-600 text-white';
      default: return 'bg-[var(--app-primary)] text-white';
    }
  };

  const getHeaderTitle = () => {
     switch (mode) {
      case 'upgrade': return 'Generate Upgrade Script';
      case 'uninstall': return 'Generate Uninstall Script';
      default: return 'Generate Install Script';
    }
  };

  const handleSwitchSort = (type: SortOption) => {
    if (sortBy === type) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(type);
      setSortAsc(true);
    }
  };

  const getActionLabel = () => {
      if (selectedIds.length === 0) return 'Select Packages';
      if (mode === 'uninstall') return 'Generate Uninstall Script';
      if (selectedIds.length === cart.length && cart.length > 1) return `Install All (${selectedIds.length}) Packages`;
      return `Install ${selectedIds.length} Selected Packages`;
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-[var(--app-surface)] border-l border-[var(--app-border)] z-50 transform transition-transform duration-300 shadow-2xl flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        <div className="flex items-center justify-between p-5 border-b border-[var(--app-border)] bg-[var(--app-surface)]">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${getModeStyles()} bg-opacity-20 text-current`}>
              <Terminal size={20} className={mode === 'upgrade' ? 'text-emerald-400' : mode === 'uninstall' ? 'text-red-400' : 'text-[var(--app-primary)]'} />
            </div>
            <h2 className="text-xl font-semibold text-[var(--app-text)]">{getHeaderTitle()}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[var(--app-bg)] rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col min-h-0 bg-[var(--app-bg)]">
          
          {cart.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--app-text-muted)]">
              <Terminal size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Your script is empty</p>
              <p className="text-sm mt-2 max-w-[200px] mb-6">Add packages from the search results to generate a script.</p>
              
              {mode === 'upgrade' && onSwitchToUpgrade && (
                 <button 
                   onClick={() => { onClose(); onSwitchToUpgrade(); }}
                   className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                 >
                    <RefreshCw size={16} />
                    Check for Updates
                 </button>
              )}
            </div>
          ) : (
            <>
              {!showPreview && !isGenerating && (
                <div className="space-y-4 mb-4">
                <div className={`p-3 rounded-lg border bg-[var(--app-surface)]/50 flex flex-col gap-2 ${
                  mode === 'upgrade' ? 'border-emerald-900/50 text-emerald-400' :
                  mode === 'uninstall' ? 'border-red-900/50 text-red-400' :
                  'border-[var(--app-border)] text-[var(--app-primary)]'
                }`}>
                  <div className="flex justify-between items-center w-full">
                    <p className="text-xs font-medium flex items-center gap-2">
                      <Info size={14} />
                      <span>Mode: <span className="uppercase font-bold">{mode}</span></span>
                    </p>
                    {mode === 'upgrade' && onSwitchToUpgrade && (
                      <button 
                        onClick={() => { onClose(); onSwitchToUpgrade(); }}
                        className="text-[10px] underline hover:text-[var(--app-text)]"
                      >
                        New Check
                      </button>
                    )}
                  </div>
                  
                  {mode === 'upgrade' && onDeepScan && (
                    <button 
                      onClick={() => { onClose(); onDeepScan(); }}
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] text-[var(--app-text-muted)] rounded text-xs transition-colors border border-emerald-900/30 w-full group"
                      title="Run 'winget upgrade' check to populate cart"
                    >
                      <Database size={12} className="group-hover:text-emerald-400 transition-colors" />
                      <span className="flex-1 text-left group-hover:text-[var(--app-text)] transition-colors">Run "Winget Upgrade" Check</span>
                      <ArrowDownUp size={12} />
                    </button>
                  )}
                </div>

                <div className="flex flex-col space-y-3">
                   <div className="flex space-x-2">
                      <div className="relative flex-1">
                          <input 
                            type="text" 
                            placeholder="Filter packages..." 
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded px-3 py-1.5 pl-8 text-xs text-[var(--app-text)] focus:outline-none focus:border-[var(--app-primary)]"
                          />
                          <Search size={12} className="absolute left-2.5 top-2 text-[var(--app-text-muted)]" />
                      </div>
                      
                      <div className="flex bg-[var(--app-surface)] rounded border border-[var(--app-border)]">
                          <button 
                            onClick={() => handleSwitchSort('name')}
                            className={`px-2 py-1.5 text-xs font-medium border-r border-[var(--app-border)] hover:bg-[var(--app-bg)] ${sortBy === 'name' ? 'text-[var(--app-primary)] bg-[var(--app-bg)]/50' : 'text-[var(--app-text-muted)]'}`}
                            title="Sort by Name"
                          >
                            Name
                          </button>
                          <button 
                            onClick={() => handleSwitchSort('version')}
                            className={`px-2 py-1.5 text-xs font-medium hover:bg-[var(--app-bg)] ${sortBy === 'version' ? 'text-[var(--app-primary)] bg-[var(--app-bg)]/50' : 'text-[var(--app-text-muted)]'}`}
                            title="Sort by Version"
                          >
                            Ver
                          </button>
                      </div>
                   </div>

                   <div className="flex bg-[var(--app-surface)] rounded-lg p-1 border border-[var(--app-border)]">
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full bg-transparent text-xs text-[var(--app-text)] focus:outline-none p-1"
                      >
                         {categories.map(cat => (
                            <option key={cat} value={cat} className="bg-[var(--app-bg)]">{cat}</option>
                         ))}
                      </select>
                   </div>

                   {(mode === 'upgrade' || mode === 'install') && (
                     <div className="flex bg-[var(--app-surface)] rounded-lg p-1 border border-[var(--app-border)]">
                        <button
                          onClick={() => setStatusFilter('all')}
                          className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${statusFilter === 'all' ? 'bg-[var(--app-border)] text-[var(--app-text)] shadow' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setStatusFilter('upgradable')}
                          className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all flex items-center justify-center gap-1 ${statusFilter === 'upgradable' ? 'bg-emerald-600 text-white shadow' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                        >
                           <RefreshCw size={10} /> Upgradable
                        </button>
                        <button
                          onClick={() => setStatusFilter('installed')}
                          className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${statusFilter === 'installed' ? 'bg-[var(--app-border)] text-[var(--app-text)] shadow' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}
                        >
                           Installed
                        </button>
                     </div>
                   )}
                </div>
              </div>
              )}

              {!showPreview && !isGenerating && (
              <div className="flex-1 overflow-y-auto mb-4 border border-[var(--app-border)] rounded-lg bg-[var(--app-surface)]/30">
                <div className="sticky top-0 z-10 bg-[var(--app-surface)] p-2 border-b border-[var(--app-border)] flex items-center justify-between">
                  <button 
                     onClick={toggleAll}
                     className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors flex items-center gap-2 group text-xs font-semibold uppercase tracking-wider"
                     title={statusFilter === 'upgradable' ? "Check All Upgradable Packages" : "Select All Visible Packages"}
                   >
                      {allVisibleSelected ? <CheckSquare size={16} /> : (isIndeterminate ? <div className="w-4 h-4 bg-[var(--app-border)] rounded flex items-center justify-center text-white text-[10px]">-</div> : <Square size={16} />)}
                      <span className="group-hover:text-[var(--app-text)] transition-colors">
                        {statusFilter === 'upgradable' ? "Check All Upgradable" : "Select All"}
                      </span>
                   </button>
                   <button onClick={onClear} className="text-red-400 hover:text-red-300 transition-colors text-xs uppercase font-bold">Clear</button>
                </div>
                
                <div className="p-2 space-y-2">
                  {filteredCart.length === 0 ? (
                    <div className="text-center py-8 text-sm text-[var(--app-text-muted)] italic">
                      No packages match your filter.
                    </div>
                  ) : (
                    filteredCart.map(pkg => {
                       const displayName = pkg.name || 'Unknown';
                       const displayChar = displayName.charAt(0) ? displayName.charAt(0) : '?';
                       const isSelected = selectedIds.includes(pkg.id);
                       const hasUpgrade = !!pkg.availableVersion;

                       return (
                      <div key={pkg.id} className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${isSelected ? 'bg-[var(--app-surface)] border-[var(--app-border)]' : 'bg-[var(--app-surface)] border-[var(--app-border)] opacity-60'}`}>
                        <div className="flex items-center space-x-3 truncate flex-1">
                          <button 
                            onClick={() => toggleSelection(pkg.id)}
                            className={`transition-colors flex-shrink-0 ${
                              isSelected ? (
                                mode === 'upgrade' ? 'text-emerald-500' : mode === 'uninstall' ? 'text-red-500' : 'text-[var(--app-primary)]'
                              ) : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                            }`}
                          >
                             {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                          <div className="w-8 h-8 rounded bg-[var(--app-border)] flex items-center justify-center text-xs font-bold text-[var(--app-text-muted)] flex-shrink-0 relative">
                            {displayChar}
                            {hasUpgrade && (
                               <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[var(--app-bg)] flex items-center justify-center">
                                 <Check size={6} className="text-[var(--app-bg)]" strokeWidth={4} />
                               </span>
                            )}
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--app-text)]' : 'text-[var(--app-text-muted)]'}`}>{displayName}</p>
                            <div className="flex items-center gap-2">
                               <p className="text-xs text-[var(--app-text-muted)] font-mono truncate">{pkg.id}</p>
                               {hasUpgrade && (
                                 <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-1 rounded">v{pkg.availableVersion}</span>
                               )}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => onRemove(pkg.id)}
                          className="p-2 text-[var(--app-text-muted)] hover:text-red-400 transition-all flex-shrink-0 ml-2"
                          title="Remove from script"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )})
                  )}
                </div>
              </div>
              )}
              
              {isGenerating && (
                <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-300">
                   <Loader2 size={48} className={`animate-spin mb-4 ${
                     mode === 'upgrade' ? 'text-emerald-500' : 
                     mode === 'uninstall' ? 'text-red-500' : 
                     'text-[var(--app-primary)]'
                   }`} />
                   <p className="text-[var(--app-text)] font-semibold">Generating Script...</p>
                </div>
              )}

              {showConfirmModal && (
                <div className="absolute inset-0 bg-[var(--app-bg)]/95 backdrop-blur-sm z-20 p-6 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200">
                   {mode === 'uninstall' ? (
                     <>
                        <div className="bg-red-500/20 p-4 rounded-full mb-4 text-red-500">
                          <ShieldAlert size={48} />
                        </div>
                        <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Warning: Uninstall Mode</h3>
                        <p className="text-[var(--app-text-muted)] mb-6 max-w-xs text-sm">
                          You are about to generate a script to uninstall <span className="text-white font-bold">{selectedIds.length}</span> application(s).
                        </p>
                        
                        <div className="w-full max-w-xs mb-6">
                            <label className="text-xs text-[var(--app-text-muted)] block mb-2 text-left">Please confirm your intent:</label>
                            <select 
                              value={selectedConfirmPhrase}
                              onChange={(e) => setSelectedConfirmPhrase(e.target.value)}
                              className="w-full bg-[var(--app-surface)] border border-red-900/50 rounded-lg px-3 py-2 text-sm text-[var(--app-text)] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                            >
                              {UNINSTALL_CONFIRMATION_PHRASES.map(phrase => (
                                  <option key={phrase} value={phrase}>{phrase}</option>
                              ))}
                            </select>
                        </div>
                     </>
                   ) : (
                     <>
                        <div className={`p-4 rounded-full mb-4 bg-opacity-10 ${mode === 'upgrade' ? 'bg-emerald-500 text-emerald-500' : 'bg-[var(--app-primary)] text-[var(--app-primary)]'}`}>
                          {mode === 'upgrade' ? <RefreshCw size={48} /> : <Download size={48} />}
                        </div>
                        <h3 className="text-xl font-bold text-[var(--app-text)] mb-2">Generate Script?</h3>
                        <p className="text-[var(--app-text-muted)] mb-6 max-w-xs text-sm">
                           Create a {mode} script for <span className="font-bold text-[var(--app-text)]">{selectedIds.length}</span> packages?
                        </p>
                     </>
                   )}

                   <div className="space-y-3 w-full max-w-xs">
                     <button 
                       onClick={confirmGeneration}
                       disabled={mode === 'uninstall' && selectedConfirmPhrase !== CORRECT_UNINSTALL_PHRASE}
                       className={`w-full py-2 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                         mode === 'uninstall' ? 'bg-red-600 hover:bg-red-500' :
                         mode === 'upgrade' ? 'bg-emerald-600 hover:bg-emerald-500' :
                         'bg-[var(--app-primary)] hover:opacity-90'
                       }`}
                     >
                       Generate Script
                     </button>
                     <button 
                       onClick={() => setShowConfirmModal(false)}
                       className="w-full py-2 bg-[var(--app-surface)] hover:bg-[var(--app-border)] text-[var(--app-text)] rounded-lg transition-colors border border-[var(--app-border)]"
                     >
                       Cancel
                     </button>
                   </div>
                </div>
              )}

              {showPreview && !isGenerating && (
                 <div className="space-y-2 flex-1 flex flex-col min-h-0">
                  <div className="flex justify-between items-end">
                     <label className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">
                       Selection Analysis
                     </label>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg p-3 text-center">
                      <div className="flex flex-col items-center">
                         <span className="text-xs text-[var(--app-text-muted)] mb-1">Total</span>
                         <span className="text-sm font-bold text-[var(--app-text)]">{analysis.total}</span>
                      </div>
                      <div className="flex flex-col items-center">
                         <span className="text-xs text-[var(--app-text-muted)] mb-1">Installs</span>
                         <span className={`text-sm font-bold ${analysis.installs > 0 ? 'text-[var(--app-primary)]' : 'text-[var(--app-text-muted)]'}`}>{analysis.installs}</span>
                      </div>
                      <div className="flex flex-col items-center">
                         <span className="text-xs text-[var(--app-text-muted)] mb-1">Upgrades</span>
                         <span className={`text-sm font-bold ${analysis.upgrades > 0 ? 'text-emerald-400' : 'text-[var(--app-text-muted)]'}`}>{analysis.upgrades}</span>
                      </div>
                  </div>

                  <div className="relative group mt-2 flex-1 overflow-hidden flex flex-col">
                    <pre className={`p-4 rounded-lg text-xs font-mono overflow-auto whitespace-pre border bg-black/50 shadow-inner flex-1 ${
                       mode === 'upgrade' ? 'text-emerald-300 border-emerald-900/30' :
                       mode === 'uninstall' ? 'text-red-300 border-red-900/30' :
                       'text-blue-300 border-blue-900/30'
                    }`}>
                      {scriptContent}
                    </pre>
                    <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button
                          onClick={handleCopy}
                          className="p-2 bg-[var(--app-surface)] hover:bg-[var(--app-border)] text-[var(--app-text)] rounded shadow-lg border border-[var(--app-border)] transition-colors"
                          title="Copy to clipboard"
                        >
                          {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                       </button>
                    </div>
                  </div>
                  
                  {excludedCount > 0 && mode === 'upgrade' && (
                     <div className="text-[10px] text-amber-500 flex items-center gap-2 bg-amber-900/20 px-3 py-2 rounded border border-amber-900/30">
                        <AlertTriangle size={12} />
                        <span>{excludedCount} items are already up-to-date and were excluded from the script.</span>
                     </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {cart.length > 0 && !showConfirmModal && !isGenerating && (
          <div className="p-5 border-t border-[var(--app-border)] bg-[var(--app-surface)]">
             {!showPreview ? (
                <button
                  onClick={handleGenerate}
                  disabled={selectedIds.length === 0}
                  className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all ${
                    selectedIds.length === 0 
                      ? 'bg-[var(--app-border)] text-[var(--app-text-muted)] cursor-not-allowed'
                      : mode === 'uninstall'
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
                        : mode === 'upgrade'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                          : 'bg-[var(--app-primary)] hover:opacity-90 text-white shadow-lg shadow-blue-900/20'
                  }`}
                >
                  <Terminal size={18} />
                  <span>{getActionLabel()}</span>
                </button>
             ) : (
                <div className="flex gap-3">
                   {/* Download Button */}
                   <button
                     onClick={handleDownload}
                     className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all ${
                       downloaded
                         ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' 
                         : 'bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-border)] border border-[var(--app-border)]'
                     }`}
                     title="Download as .ps1 file"
                   >
                     {downloaded ? (
                        <>
                           <CheckCircle2 size={18} />
                           <span>Saved</span>
                        </>
                     ) : (
                        <>
                           <FileDown size={18} />
                           <span>Download</span>
                        </>
                     )}
                   </button>
                   
                   {/* Copy Button */}
                   <button
                     onClick={handleCopy}
                     className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all ${
                       copied 
                         ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' 
                         : 'bg-[var(--app-primary)] hover:opacity-90 text-white shadow-lg shadow-blue-900/20'
                     }`}
                   >
                     {copied ? (
                       <>
                         <CheckCircle2 size={18} />
                         <span>Copied!</span>
                       </>
                     ) : (
                       <>
                         <Copy size={18} />
                         <span>Copy Text</span>
                       </>
                     )}
                   </button>
                   
                   <button 
                     onClick={() => setShowPreview(false)}
                     className="px-4 py-3 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] text-[var(--app-text)] rounded-lg font-semibold border border-[var(--app-border)]"
                     title="Regenerate"
                   >
                      <RotateCcw size={18} />
                   </button>
                </div>
             )}
          </div>
        )}
      </div>
    </>
  );
};