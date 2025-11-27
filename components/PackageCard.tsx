import React, { useState } from 'react';
import { WingetPackage, AppMode } from '../types';
import { Plus, Check, Copy, RefreshCw, Trash2, ChevronDown, ChevronUp, Globe, Tag, Info, Layers, Sparkles, Terminal, GitFork, Microscope, Star } from 'lucide-react';

interface PackageCardProps {
  pkg: WingetPackage;
  isInCart: boolean;
  onToggleCart: (pkg: WingetPackage) => void;
  onCopyCommand: (id: string, mode: AppMode) => void;
  onAskAI: (pkg: WingetPackage) => void;
  onFindAlternatives?: (pkg: WingetPackage) => void;
  onAnalyze?: (pkg: WingetPackage) => void;
  mode: AppMode;
}

export const PackageCard: React.FC<PackageCardProps> = ({ pkg, isInCart, onToggleCart, onCopyCommand, onAskAI, onFindAlternatives, onAnalyze, mode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  // Defensive programming for optional/missing fields
  const displayName = pkg.name || 'Unknown Package';
  const displayChar = displayName.charAt(0) ? displayName.charAt(0).toUpperCase() : '?';

  const handleToggleCart = () => {
    setIsAnimating(true);
    onToggleCart(pkg);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyCommand(pkg.id, mode);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  // Determine Status Labels
  const isUpdateAvailable = !!pkg.availableVersion;
  const isInstalled = !!pkg.version;

  // Mode-specific styling and icons
  const getModeConfig = () => {
    switch (mode) {
      case 'upgrade':
        return {
          icon: <RefreshCw size={16} />,
          text: isInCart ? 'Added to Upgrade' : 'Add to Upgrade',
          btnClass: isInCart 
            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20' 
            : 'bg-emerald-600/80 hover:bg-emerald-500 shadow-emerald-900/20',
          borderClass: 'hover:border-emerald-500/50',
          gradientClass: 'from-emerald-500 to-teal-600',
          cmdColor: 'text-emerald-300'
        };
      case 'uninstall':
        return {
          icon: <Trash2 size={16} />,
          text: isInCart ? 'Added to Uninstall' : 'Add to Uninstall',
          btnClass: isInCart 
            ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' 
            : 'bg-red-600/80 hover:bg-red-500 shadow-red-900/20',
          borderClass: 'hover:border-red-500/50',
          gradientClass: 'from-red-500 to-rose-600',
          cmdColor: 'text-red-300'
        };
      case 'install':
      default:
        return {
          icon: <Plus size={16} />,
          text: isInCart ? 'Added to Install' : 'Add to Install',
          btnClass: isInCart 
            ? 'bg-[var(--app-primary)] hover:opacity-90 shadow-blue-900/20' 
            : 'bg-[var(--app-primary)] hover:opacity-90 shadow-blue-900/20',
          borderClass: 'hover:border-[var(--app-primary)]/50',
          gradientClass: 'from-[var(--app-primary)] to-indigo-600',
          cmdColor: 'text-blue-300'
        };
    }
  };

  const config = getModeConfig();

  return (
    <div className={`group relative bg-[var(--app-surface)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] ${config.borderClass} rounded-xl p-5 transition-all duration-200 flex flex-col h-full shadow-lg hover:shadow-xl`}>
      
      {/* Status Badges */}
      <div className="absolute top-3 right-3 flex gap-2">
        {isUpdateAvailable && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Update Available
          </span>
        )}
        {!isUpdateAvailable && isInstalled && (
           <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[var(--app-bg)] text-[var(--app-text-muted)] border border-[var(--app-border)]">
             Installed
           </span>
        )}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-3 pt-4">
        <div className="flex items-center space-x-3 w-full">
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${config.gradientClass} flex items-center justify-center text-white font-bold text-xl shadow-inner shrink-0`}>
            {displayChar}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[var(--app-text)] leading-tight truncate pr-20" title={displayName}>{displayName}</h3>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate flex items-center gap-1">
              <Globe size={10} />
              {pkg.publisher || 'Unknown Publisher'}
            </p>
          </div>
        </div>
      </div>

      {/* Version Info Row */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-[var(--app-bg)]/50 p-2 rounded-lg border border-[var(--app-border)]">
        <div className="flex flex-col border-r border-[var(--app-border)] pr-2">
           <span className="text-[var(--app-text-muted)] text-[9px] uppercase font-bold tracking-wider mb-0.5">Installed</span>
           {pkg.version ? (
             <span className="text-[var(--app-text)] font-mono truncate" title={pkg.version}>{pkg.version}</span>
           ) : (
             <span className="text-[var(--app-text-muted)] italic">None</span>
           )}
        </div>
        <div className="flex flex-col pl-2">
           <span className={`${isUpdateAvailable ? 'text-emerald-500' : 'text-[var(--app-text-muted)]'} text-[9px] uppercase font-bold tracking-wider mb-0.5`}>
             {isUpdateAvailable ? 'Available' : 'Latest'}
           </span>
           {pkg.availableVersion ? (
             <span className="text-emerald-400 font-mono font-bold truncate" title={pkg.availableVersion}>{pkg.availableVersion}</span>
           ) : (
             <span className="text-[var(--app-text-muted)] italic">-</span>
           )}
        </div>
      </div>

      {/* Description */}
      <div className="flex-grow mb-4">
        <p className={`text-sm text-[var(--app-text-muted)] leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
          {pkg.description || 'No description available.'}
        </p>
        
        {/* Expandable Details Section with CSS Grid Animation */}
        <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
           <div className="overflow-hidden">
             <div className="pt-3 border-t border-[var(--app-border)] grid grid-cols-1 gap-3 text-xs bg-black/20 p-2 rounded mt-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                     <span className="block text-[var(--app-text-muted)] text-[10px] uppercase mb-1 font-bold">Category</span>
                     <span className="text-[var(--app-text)] flex items-center gap-1 bg-[var(--app-bg)] px-1.5 py-0.5 rounded w-fit">
                        <Tag size={10} /> {pkg.category || 'App'}
                     </span>
                  </div>
                  <div className="col-span-2">
                     <span className="block text-[var(--app-text-muted)] text-[10px] uppercase mb-1 font-bold">Package ID</span>
                     <span className="text-[var(--app-text)] font-mono truncate block bg-[var(--app-bg)] px-1.5 py-0.5 rounded select-all" title={pkg.id}>
                        {pkg.id}
                     </span>
                  </div>
                </div>
                {pkg.publisher && (
                   <div>
                     <span className="block text-[var(--app-text-muted)] text-[10px] uppercase mb-1 font-bold">Publisher</span>
                     <span className="text-[var(--app-text)]">{pkg.publisher}</span>
                   </div>
                )}
             </div>
           </div>
        </div>

        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-[var(--app-primary)] hover:text-[var(--app-primary-hover)] mt-2 flex items-center gap-1 font-medium transition-colors focus:outline-none w-full justify-center py-1 hover:bg-[var(--app-bg)] rounded"
        >
          {isExpanded ? (
            <>Less Info <ChevronUp size={12} /></>
          ) : (
            <>More Info <ChevronDown size={12} /></>
          )}
        </button>
      </div>

      {/* Footer Actions */}
      <div className="mt-auto space-y-3">
        {/* Action Grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {/* Ask AI Button */}
          <button 
             onClick={() => onAskAI(pkg)}
             className="col-span-1 flex flex-col items-center justify-center py-1.5 bg-[var(--app-bg)] hover:bg-[var(--app-primary)]/20 text-[var(--app-text-muted)] hover:text-[var(--app-primary)] rounded-lg text-[10px] font-medium transition-colors border border-transparent hover:border-[var(--app-primary)]/30"
             title="Ask AI"
           >
             <Sparkles size={14} className="mb-0.5" />
             Ask
           </button>
           
           {/* Find Alternatives */}
           <button 
             onClick={() => onFindAlternatives && onFindAlternatives(pkg)}
             className="col-span-1 flex flex-col items-center justify-center py-1.5 bg-[var(--app-bg)] hover:bg-[var(--app-primary)]/20 text-[var(--app-text-muted)] hover:text-[var(--app-primary)] rounded-lg text-[10px] font-medium transition-colors border border-transparent hover:border-[var(--app-primary)]/30"
             title="Find Alternatives"
           >
             <GitFork size={14} className="mb-0.5" />
             Similars
           </button>

           {/* Evaluate/Analyze */}
           <button 
             onClick={() => onAnalyze && onAnalyze(pkg)}
             className="col-span-1 flex flex-col items-center justify-center py-1.5 bg-[var(--app-bg)] hover:bg-[var(--app-primary)]/20 text-[var(--app-text-muted)] hover:text-[var(--app-primary)] rounded-lg text-[10px] font-medium transition-colors border border-transparent hover:border-[var(--app-primary)]/30"
             title="Evaluate (Pros/Cons)"
           >
             <Star size={14} className="mb-0.5" />
             Review
           </button>

           {/* Copy Command Button */}
           <button 
             onClick={handleCopy}
             className={`col-span-1 flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-medium transition-colors border ${
               showCopied 
                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                : 'bg-[var(--app-bg)] hover:bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] border-transparent'
             }`}
             title={`Copy Command`}
           >
             {showCopied ? <Check size={14} className="mb-0.5" /> : <Terminal size={14} className="mb-0.5" />}
             {showCopied ? 'Copied' : 'Cmd'}
           </button>
        </div>

        {/* Add/Remove Cart Button */}
        <button
          onClick={handleToggleCart}
          className={`w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-white shadow-lg ${config.btnClass} ${
            isAnimating ? 'scale-95 ring-2 ring-white/20' : 'scale-100'
          }`}
        >
          {isInCart ? <Check size={16} className={isAnimating ? 'animate-bounce' : ''} /> : config.icon}
          <span>{config.text}</span>
        </button>
      </div>
    </div>
  );
};