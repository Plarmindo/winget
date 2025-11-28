import React, { useState } from 'react';
import { WingetPackage, AppMode } from '../types';
import { Plus, Check, Copy, RefreshCw, Trash2, ChevronDown, ChevronUp, Globe, Tag, Info, Layers, Sparkles, Terminal, GitFork, Microscope, Star, ShieldCheck, ThumbsUp, ThumbsDown, Heart } from 'lucide-react';

interface PackageCardProps {
  pkg: WingetPackage;
  isInCart: boolean;
  onToggleCart: (pkg: WingetPackage) => void;
  onCopyCommand: (id: string, mode: AppMode) => void;
  onAskAI: (pkg: WingetPackage) => void;
  onFindAlternatives?: (pkg: WingetPackage) => void;
  onAnalyze?: (pkg: WingetPackage) => void;
  mode: AppMode;
  compactMode?: boolean;
}

export const PackageCard: React.FC<PackageCardProps> = ({ pkg, isInCart, onToggleCart, onCopyCommand, onAskAI, onFindAlternatives, onAnalyze, mode, compactMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  
  // Feedback States (Local only for demo)
  const [isLiked, setIsLiked] = useState<boolean | null>(null);
  const [isSaved, setIsSaved] = useState(false);

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
  
  const handleVerify = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open Google Search to verify the package ID
    window.open(`https://www.google.com/search?q=winget+package+"${pkg.id}"`, '_blank');
  };

  const handleLike = (e: React.MouseEvent, val: boolean) => {
     e.stopPropagation();
     setIsLiked(prev => prev === val ? null : val);
  };

  const handleSave = (e: React.MouseEvent) => {
     e.stopPropagation();
     setIsSaved(!isSaved);
  };

  // Determine Status Labels
  const isUpdateAvailable = !!pkg.availableVersion;
  const isInstalled = !!pkg.version;

  // Mode-specific styling and icons
  const getModeConfig = () => {
    switch (mode) {
      case 'upgrade':
        return {
          icon: <RefreshCw size={compactMode ? 14 : 16} />,
          text: isInCart ? 'Added' : 'Add Upgrade',
          btnClass: isInCart 
            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20' 
            : 'bg-emerald-600/80 hover:bg-emerald-500 shadow-emerald-900/20',
          borderClass: 'hover:border-emerald-500/50',
          gradientClass: 'from-emerald-500 to-teal-600',
          cmdColor: 'text-emerald-300'
        };
      case 'uninstall':
        return {
          icon: <Trash2 size={compactMode ? 14 : 16} />,
          text: isInCart ? 'Added' : 'Uninstall',
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
          icon: <Plus size={compactMode ? 14 : 16} />,
          text: isInCart ? 'Added' : 'Install',
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
  const paddingClass = compactMode ? 'p-3' : 'p-5';

  return (
    <div className={`group relative bg-[var(--app-surface)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] ${config.borderClass} rounded-xl ${paddingClass} transition-all duration-300 transform hover:scale-[1.02] hover:shadow-2xl flex flex-col h-full shadow-lg overflow-hidden`}>
      
      {/* Quick Context Hint on Hover */}
      <div className="absolute top-0 right-0 p-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
         <div className="bg-[var(--app-surface)]/90 backdrop-blur border border-[var(--app-border)] shadow-lg rounded px-2 py-1 text-[10px] text-[var(--app-text)] font-mono whitespace-nowrap">
            {pkg.id} • {pkg.category || 'App'}
         </div>
      </div>

      {/* Status Badges */}
      <div className={`absolute ${compactMode ? 'top-2 right-2' : 'top-3 right-3'} flex gap-2 transition-opacity duration-200 group-hover:opacity-0`}>
        {isUpdateAvailable && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {compactMode ? 'Upd' : 'Update Available'}
          </span>
        )}
        {!isUpdateAvailable && isInstalled && (
           <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-[var(--app-bg)] text-[var(--app-text-muted)] border border-[var(--app-border)]">
             Installed
           </span>
        )}
      </div>

      {/* Header */}
      <div className={`flex justify-between items-start ${compactMode ? 'mb-2 pt-2' : 'mb-3 pt-4'}`}>
        <div className="flex items-center space-x-3 w-full">
          <div className={`${compactMode ? 'w-10 h-10 text-lg' : 'w-12 h-12 text-xl'} rounded-lg bg-gradient-to-br ${config.gradientClass} flex items-center justify-center text-white font-bold shadow-inner shrink-0`}>
            {displayChar}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold text-[var(--app-text)] leading-tight truncate pr-16`} title={displayName}>{displayName}</h3>
            <p className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate flex items-center gap-1">
              <Globe size={10} />
              {pkg.publisher || 'Unknown Publisher'}
            </p>
          </div>
        </div>
      </div>

      {/* Version Info Row */}
      <div className={`grid grid-cols-2 gap-2 text-xs ${compactMode ? 'mb-2' : 'mb-3'} bg-[var(--app-bg)]/50 p-2 rounded-lg border border-[var(--app-border)]`}>
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
      {!compactMode && (
        <div className="flex-grow mb-4">
          <p className={`text-sm text-[var(--app-text-muted)] leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
            {pkg.description || 'No description available.'}
          </p>
          
          {/* Visible Feedback Toolbar (New) */}
          <div className="flex items-center gap-2 mt-3 mb-2">
             <div className="flex bg-[var(--app-bg)] rounded-lg p-0.5 border border-[var(--app-border)]">
               <button onClick={(e) => handleLike(e, true)} className={`p-1.5 rounded hover:bg-[var(--app-surface)] transition-colors ${isLiked === true ? 'text-green-400' : 'text-[var(--app-text-muted)]'}`} title="Thumbs Up">
                  <ThumbsUp size={14} />
               </button>
               <div className="w-[1px] bg-[var(--app-border)] my-1"></div>
               <button onClick={(e) => handleLike(e, false)} className={`p-1.5 rounded hover:bg-[var(--app-surface)] transition-colors ${isLiked === false ? 'text-red-400' : 'text-[var(--app-text-muted)]'}`} title="Thumbs Down">
                  <ThumbsDown size={14} />
               </button>
             </div>
             <button onClick={handleSave} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg border transition-all ${isSaved ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' : 'text-[var(--app-text-muted)] border-[var(--app-border)] bg-[var(--app-bg)] hover:text-[var(--app-text)] hover:border-[var(--app-text-muted)]'}`}>
                <Heart size={14} fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? "Saved" : "Save"}
             </button>
          </div>
          
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
      )}

      {compactMode && (
         <div className="mb-3 text-xs bg-[var(--app-bg)] px-2 py-1 rounded font-mono text-[var(--app-text-muted)] truncate" title={pkg.id}>
            {pkg.id}
         </div>
      )}

      {/* Footer Actions */}
      <div className="mt-auto space-y-3">
        <div className="grid grid-cols-5 gap-1.5">
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
             Alts
           </button>

           {/* Evaluate */}
           <button 
             onClick={() => onAnalyze && onAnalyze(pkg)}
             className="col-span-1 flex flex-col items-center justify-center py-1.5 bg-[var(--app-bg)] hover:bg-[var(--app-primary)]/20 text-[var(--app-text-muted)] hover:text-[var(--app-primary)] rounded-lg text-[10px] font-medium transition-colors border border-transparent hover:border-[var(--app-primary)]/30"
             title="Evaluate (Pros/Cons)"
           >
             <Star size={14} className="mb-0.5" />
             Review
           </button>
           
           {/* Verify ID Button (New) */}
           <button 
             onClick={handleVerify}
             className="col-span-1 flex flex-col items-center justify-center py-1.5 bg-[var(--app-bg)] hover:bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded-lg text-[10px] font-medium transition-colors border border-transparent hover:border-[var(--app-primary)]/30"
             title="Verify ID on Google"
           >
             <ShieldCheck size={14} className="mb-0.5 text-amber-500" />
             Verify
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