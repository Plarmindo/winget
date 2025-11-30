
import React, { useState, useEffect, useRef } from 'react';
import { Settings, Box, ShoppingBag, Search, Download, RefreshCw, Trash2, Package, HelpCircle, Monitor, Globe } from 'lucide-react';
import AppLogo from './AppLogo';
import { Tooltip } from './Tooltip';
import { useAppStore } from '../stores/store';
import { SearchInput } from './SearchInput';
import { CommandPalette } from './CommandPalette';
import { PackageManagerType } from '../types';

interface NavbarProps {
  handleSearch: (q: string) => void;
  stopSearch: () => void;
  openDrawer: () => void;
  openSettings: () => void;
  openHelp: () => void;
  resetState: () => void;
  isDesktop?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  handleSearch, stopSearch, openDrawer, openSettings, openHelp, resetState, isDesktop
}) => {
  const { settings, updateSettings, mode, setMode, query, setQuery, loading, cart, clearCart } = useAppStore();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const paletteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsPaletteOpen(false);
      }
      if (e.key === 'F1') {
        e.preventDefault();
        openHelp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openHelp]);

  useEffect(() => {
    if (isPaletteOpen) {
      setTimeout(() => paletteInputRef.current?.focus(), 50);
    } else {
      setPaletteSearch('');
    }
  }, [isPaletteOpen]);

  const commands = [
    { 
      id: 'search', 
      label: 'Search Packages', 
      icon: <Search size={16} />, 
      action: () => { setMode('install'); const input = document.querySelector('input[type="text"]') as HTMLInputElement; input?.focus(); } 
    },
    { id: 'mode-install', label: 'Install Mode', icon: <Download size={16} />, action: () => setMode('install') },
    { id: 'mode-upgrade', label: 'Upgrade Mode', icon: <RefreshCw size={16} />, action: () => setMode('upgrade') },
    { id: 'mode-uninstall', label: 'Uninstall Mode', icon: <Trash2 size={16} />, action: () => setMode('uninstall') },
    { id: 'open-drawer', label: 'Open Script Drawer', icon: <Package size={16} />, action: openDrawer },
    { id: 'settings', label: 'Open Settings', icon: <Settings size={16} />, action: openSettings },
    { id: 'help', label: 'Help & Walkthrough', icon: <HelpCircle size={16} />, action: openHelp },
    { id: 'clear-cart', label: 'Clear Cart', icon: <Trash2 size={16} />, action: () => { if(window.confirm("Clear cart?")) clearCart(); } }
  ];

  const getThemeColor = () => {
    switch (mode) {
      case 'upgrade': return 'from-emerald-600 to-teal-500';
      case 'uninstall': return 'from-red-600 to-rose-500';
      default: return 'from-[var(--app-primary)] to-cyan-500';
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-30 bg-[var(--app-surface)]/80 backdrop-blur-md border-b border-[var(--app-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={resetState}>
              <div className={`bg-gradient-to-r ${getThemeColor()} p-2 rounded-lg transition-all duration-500`}>
                <AppLogo size={24} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--app-text)] to-[var(--app-text-muted)] leading-tight">
                  {settings.activePackageManager.charAt(0).toUpperCase() + settings.activePackageManager.slice(1)} Web
                </span>
                <span className={`text-[10px] font-medium flex items-center gap-1 ${isDesktop ? 'text-green-500' : 'text-amber-500'}`}>
                  {isDesktop ? <Monitor size={10} /> : <Globe size={10} />}
                  {isDesktop ? 'Local System: Connected' : 'Web Mode: Read Only'}
                </span>
              </div>
            </div>

            {mode === 'install' && (
              <div className="hidden md:block flex-1 max-w-lg mx-8 relative">
                <SearchInput 
                  value={query}
                  onChange={setQuery}
                  onSearch={handleSearch}
                  onStop={stopSearch}
                  loading={loading}
                  placeholder={`Search ${settings.activePackageManager} packages...`}
                />
              </div>
            )}
            {mode !== 'install' && <div className="hidden md:block flex-1" />}

            <div className="flex items-center space-x-4">
              <div className="hidden md:block relative">
                <select 
                  value={settings.activePackageManager} 
                  onChange={(e) => updateSettings({ activePackageManager: e.target.value as PackageManagerType })} 
                  className="bg-[var(--app-bg)] border border-[var(--app-border)] text-[var(--app-text)] text-xs font-medium px-3 py-1.5 rounded-lg focus:outline-none cursor-pointer hover:border-[var(--app-primary)]/50 appearance-none pr-8"
                >
                  <option value="winget">Winget (Win)</option>
                  <option value="chocolatey">Chocolatey (Win)</option>
                  <option value="scoop">Scoop (Win)</option>
                  <option value="brew">Homebrew (Mac/Lin)</option>
                  <option value="apt">APT (Linux)</option>
                  <option value="github">GitHub (Any)</option>
                </select>
                <div className="absolute right-2 top-2 pointer-events-none text-[var(--app-text-muted)]"><Box size={12} /></div>
              </div>

              <Tooltip content="Help & Walkthrough (F1)">
                 <button 
                  onClick={openHelp} 
                  className="hidden md:flex items-center justify-center p-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface)] rounded-full transition-colors" 
                >
                  <HelpCircle size={20} />
                </button>
              </Tooltip>

              <button 
                onClick={openSettings} 
                className="hidden md:flex items-center justify-center p-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface)] rounded-full transition-colors" 
                title="Settings"
              >
                <Settings size={20} />
              </button>
              
              <button 
                onClick={() => setIsPaletteOpen(true)} 
                className="hidden md:flex items-center space-x-1 text-xs font-mono text-[var(--app-text-muted)] border border-[var(--app-border)] rounded px-2 py-1 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] transition-colors" 
                title="Command Palette (Ctrl+K)"
              >
                <span>CTRL</span><span>K</span>
              </button>
              
              <Tooltip content={`View Cart (${cart.length} items)`}>
                <button 
                  onClick={openDrawer} 
                  className="relative p-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors hover:bg-[var(--app-surface)] rounded-full"
                >
                  <ShoppingBag size={24} />
                  {cart.length > 0 && (
                    <span className={`absolute top-0 right-0 h-5 w-5 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[var(--app-bg)] ${mode === 'upgrade' ? 'bg-emerald-600' : mode === 'uninstall' ? 'bg-red-600' : 'bg-[var(--app-primary)]'}`}>
                      {cart.length}
                    </span>
                  )}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </nav>

      <CommandPalette 
        isOpen={isPaletteOpen} 
        onClose={() => setIsPaletteOpen(false)} 
        inputRef={paletteInputRef} 
        searchTerm={paletteSearch} 
        setSearchTerm={setPaletteSearch} 
        commands={commands.filter(c => c.label.toLowerCase().includes(paletteSearch.toLowerCase()))} 
      />
    </>
  );
};
