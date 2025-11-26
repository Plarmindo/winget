import React, { useState, useEffect, useCallback } from 'react';
import { Search, Package, Terminal, Loader2, Info as InfoIcon, Github, Menu, ShoppingBag } from 'lucide-react';
import { WingetPackage } from './types';
import { searchPackages } from './services/wingetService';
import { PackageCard } from './components/PackageCard';
import { ScriptDrawer } from './components/ScriptDrawer';

const PRESET_CATEGORIES = [
  "Development", "Gaming", "Productivity", "Utilities", "Multimedia", "System"
];

function App() {
  const [query, setQuery] = useState('');
  const [packages, setPackages] = useState<WingetPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<WingetPackage[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load essentials on mount
  useEffect(() => {
    handleSearch("POPULAR_ESSENTIALS");
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setSearched(true);
    // If it's the initial load (POPULAR_ESSENTIALS), don't show it in the search bar
    if (searchQuery !== "POPULAR_ESSENTIALS") {
        setQuery(searchQuery);
    }
    
    try {
      const results = await searchPackages(searchQuery);
      setPackages(results);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCart = (pkg: WingetPackage) => {
    setCart(prev => {
      const exists = prev.find(item => item.id === pkg.id);
      if (exists) {
        return prev.filter(item => item.id !== pkg.id);
      }
      return [...prev, pkg];
    });
  };

  const copySingleCommand = (id: string) => {
    navigator.clipboard.writeText(`winget install ${id}`);
    // Optional: Toast notification here
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleSearch("POPULAR_ESSENTIALS")}>
              <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-2 rounded-lg">
                <Terminal size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                WinGet Web
              </span>
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
              <input
                type="text"
                value={query === "POPULAR_ESSENTIALS" ? "" : query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                placeholder="Search packages (e.g. 'vscode', 'python')..."
                className="w-full bg-slate-950 border border-slate-700 rounded-full py-2 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 text-slate-200 transition-all"
              />
              <Search className="absolute left-4 top-2.5 text-slate-500" size={18} />
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="relative p-2 text-slate-400 hover:text-white transition-colors hover:bg-slate-800 rounded-full"
              >
                <ShoppingBag size={24} />
                {cart.length > 0 && (
                  <span className="absolute top-0 right-0 h-5 w-5 bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-slate-900">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Search Bar (Visible only on small screens) */}
      <div className="md:hidden p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="relative">
          <input
            type="text"
            value={query === "POPULAR_ESSENTIALS" ? "" : query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            placeholder="Search packages..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-200"
          />
          <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Categories / Tags */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button 
             onClick={() => handleSearch("POPULAR_ESSENTIALS")}
             className="px-4 py-1.5 rounded-full text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 transition-colors"
          >
            Essentials
          </button>
          {PRESET_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleSearch(cat.toLowerCase())}
              className="px-4 py-1.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {loading ? 'Searching...' : searched ? (query && query !== "POPULAR_ESSENTIALS" ? `Results for "${query}"` : 'Recommended') : 'Popular Packages'}
          </h2>
          {!loading && packages.length > 0 && (
             <span className="text-sm text-slate-500 hidden sm:inline-block">Found {packages.length} packages</span>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
            <p className="text-slate-400 animate-pulse">Querying package database...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && packages.length === 0 && searched && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
            <Package size={48} className="mb-4 opacity-20" />
            <p className="text-lg">No packages found.</p>
            <p className="text-sm">Try a different search term.</p>
          </div>
        )}

        {/* Grid */}
        {!loading && packages.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                isInCart={!!cart.find(c => c.id === pkg.id)}
                onToggleCart={toggleCart}
                onCopyCommand={copySingleCommand}
              />
            ))}
          </div>
        )}
      </main>

      {/* Script Drawer */}
      <ScriptDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)}
        cart={cart}
        onRemove={(id) => setCart(prev => prev.filter(p => p.id !== id))}
        onClear={() => setCart([])}
      />

    </div>
  );
}

export default App;