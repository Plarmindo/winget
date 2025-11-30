
import React from 'react';
import { WingetPackage, AppMode, AppSettings } from '../types';
import { PackageCard } from './PackageCard';
import { generateAppDetailsPrompt, generateAlternativesPrompt, generateEvaluationPrompt } from '../services/wingetService';

interface PackageGridProps {
  packages: WingetPackage[];
  cart: WingetPackage[];
  onToggleCart: (pkg: WingetPackage) => void;
  onCopyCommand: (id: string, mode: AppMode) => void;
  onExecute?: (id: string, mode: AppMode) => void;
  setPendingChatQuery: (query: string) => void;
  handleSearch: (query: string) => void;
  setMode: (mode: AppMode) => void;
  mode: AppMode;
  settings: AppSettings;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  compareList?: WingetPackage[];
  onToggleCompare?: (pkg: WingetPackage) => void;
  isDesktop?: boolean;
}

export const PackageGrid: React.FC<PackageGridProps> = ({ 
  packages, cart, onToggleCart, onCopyCommand, onExecute, setPendingChatQuery, handleSearch, setMode, mode, settings, currentPage, setCurrentPage, compareList, onToggleCompare, isDesktop 
}) => {
  const itemsPerPage = settings.itemsPerPage || 9;
  const paginatedPackages = packages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (packages.length === 0) return null;

  return (
    <>
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${settings.compactMode ? 'gap-3' : 'gap-6'}`}>
        {paginatedPackages.map(pkg => (
          <PackageCard 
            key={pkg.id} 
            pkg={pkg} 
            isInCart={!!cart.find(c => c.id === pkg.id)} 
            onToggleCart={onToggleCart} 
            onCopyCommand={onCopyCommand} 
            onExecute={onExecute}
            onAskAI={() => setPendingChatQuery(generateAppDetailsPrompt(pkg.name, pkg.id))} 
            onFindAlternatives={() => { setMode('install'); handleSearch(generateAlternativesPrompt(pkg.name)); }} 
            onAnalyze={() => setPendingChatQuery(generateEvaluationPrompt(pkg.name))}
            onToggleCompare={onToggleCompare}
            isInCompare={compareList ? !!compareList.find(c => c.id === pkg.id) : false}
            mode={mode} 
            compactMode={settings.compactMode} 
            isDesktop={isDesktop}
          />
        ))}
      </div>
      {Math.ceil(packages.length / itemsPerPage) > 1 && (
        <div className="flex justify-center mt-8 gap-4">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
            disabled={currentPage === 1} 
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Prev
          </button>
          <span className="self-center">Page {currentPage}</span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(packages.length / itemsPerPage), p + 1))} 
            disabled={currentPage === Math.ceil(packages.length / itemsPerPage)} 
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
};
