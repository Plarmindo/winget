import React, { useState } from 'react';
import { WingetPackage, AppMode, GitHubAction } from '../types';
import { useAppStore } from '../stores/store';
import { generateAppDetailsPrompt, generateAlternativesPrompt, generateEvaluationPrompt } from '../services/wingetService';
import { Plus, Check, RefreshCw, Trash2, ChevronDown, ChevronUp, Globe, Sparkles, Terminal, GitFork, Star, Scale, Loader2, Gift, CircleDollarSign, ExternalLink, Eye, Info } from 'lucide-react';

interface PackageCardProps {
  pkg: WingetPackage;
  onExecute?: (id: string, mode: AppMode) => void;
  handleSearch: (q: string) => void;
  onFetchDetails?: (pkg: WingetPackage) => Promise<string>;
  onGitHubAction?: (id: string, action: GitHubAction) => void;
  isDesktop?: boolean;
  style?: React.CSSProperties;
}

export const PackageCard: React.FC<PackageCardProps> = ({ pkg, onExecute, handleSearch, onFetchDetails, onGitHubAction, isDesktop, style }) => {
  const { cart, addToCart, removeFromCart, mode, settings, compareList, toggleCompare, setPendingChatQuery, setMode } = useAppStore();

  const isInCart = !!cart.find(c => c.id === pkg.id);
  const isInCompare = !!compareList.find(c => c.id === pkg.id);

  const [isExpanded, setIsExpanded] = useState(false);

  const [showCopied, setShowCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const displayName = pkg.name || 'Unknown Package';
  const displayChar = displayName.charAt(0) ? displayName.charAt(0).toUpperCase() : '?';

  const handleToggleCart = () => {
    if (isInCart) removeFromCart(pkg.id);
    else addToCart(pkg);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pm = settings.activePackageManager;
    const cmd = pm === 'winget' ? `winget ${mode === 'uninstall' ? 'uninstall' : mode} ${pkg.id} -e` : (pm === 'github' ? `git clone https://github.com/${pkg.id}.git` : `${pm} ${mode} ${pkg.id}`);
    navigator.clipboard.writeText(cmd);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleExecute = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onExecute || isExecuting) return;

    if (confirm(`Are you sure you want to ${settings.activePackageManager === 'github' ? 'clone' : mode} ${pkg.name} immediately?`)) {
      setIsExecuting(true);
      try {
        await onExecute(pkg.id, mode);
      } catch (error) {
        console.error('Execute error:', error);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const toggleExpand = async () => {
    const willExpand = !isExpanded;
    setIsExpanded(willExpand);
    if (willExpand && !aiSummary && onFetchDetails) {
      setLoadingSummary(true);
      try {
        const text = await onFetchDetails(pkg);
        setAiSummary(text);
      } catch (e) {
        setAiSummary("Unable to load AI insights.");
      } finally {
        setLoadingSummary(false);
      }
    }
  };

  const isGitHub = pkg.source === 'github' || settings.activePackageManager === 'github';

  const getModeConfig = () => {
    switch (mode) {
      case 'upgrade':
        if (isGitHub) {
          return {
            icon: <RefreshCw size={settings.compactMode ? 14 : 16} />,
            text: 'Not Supported',
            btnClass: 'bg-gray-500/50 text-gray-300 cursor-not-allowed',
            gradientClass: 'from-gray-600 to-gray-700',
            disabled: true
          };
        }
        return {
          icon: <RefreshCw size={settings.compactMode ? 14 : 16} />,
          text: isInCart ? 'Added' : 'Upgrade',
          btnClass: isInCart ? 'bg-emerald-600' : 'bg-emerald-600/80 hover:bg-emerald-500',
          gradientClass: 'from-emerald-500 to-teal-600',
          disabled: false
        };
      case 'uninstall':
        return {
          icon: <Trash2 size={settings.compactMode ? 14 : 16} />,
          text: isInCart ? 'Added' : 'Uninstall',
          btnClass: isInCart ? 'bg-red-600' : 'bg-red-600/80 hover:bg-red-500',
          gradientClass: 'from-red-500 to-rose-600',
          disabled: false
        };
      case 'install':
      default:
        return {
          icon: <Plus size={settings.compactMode ? 14 : 16} />,
          text: isInCart ? 'Added' : 'Install',
          btnClass: isInCart ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-primary)] hover:opacity-90',
          gradientClass: 'from-[var(--app-primary)] to-indigo-600',
          disabled: false
        };
    }
  };

  const config = getModeConfig();

  return (
    <div style={style} className={`group relative bg-[var(--app-surface)] border ${isInCompare ? 'border-[var(--app-primary)] ring-2 ring-[var(--app-primary)]/30' : 'border-[var(--app-border)] hover:border-[var(--app-primary)]/50'} rounded-xl p-4 transition-all duration-300 flex flex-col shadow-lg overflow-hidden h-full`}>
      {/* License Status Badge */}
      {pkg.isFree !== undefined && (
        <div className={`absolute top-3 right-3 p-1.5 rounded-full z-10 ${pkg.isFree ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`} title={pkg.isFree ? "Free / Open Source" : "Paid / Freemium / Trial"}>
          {pkg.isFree ? <Gift size={12} /> : <CircleDollarSign size={12} />}
        </div>
      )}

      {/* Badges and Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-3 w-full pr-6">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradientClass} flex items-center justify-center text-white font-bold shadow-inner shrink-0`}>
            {displayChar}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[var(--app-text)] leading-tight truncate" title={displayName}>{displayName}</h3>
            <p className="text-xs text-[var(--app-text-muted)] truncate flex items-center gap-1">
              <Globe size={10} /> {pkg.publisher || 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* Version and Category Grid (Or Stars/Forks for GitHub) */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-[var(--app-bg)]/50 p-2 rounded-lg border border-[var(--app-border)] shrink-0">
        {pkg.stars !== undefined ? (
          <>
            <div className="truncate flex items-center gap-1"><Star size={10} className="text-amber-400" /> <span className="font-mono text-[var(--app-text)]">{pkg.stars}</span></div>
            <div className="truncate flex items-center gap-1 justify-end"><GitFork size={10} className="text-[var(--app-text-muted)]" /> <span className="font-mono text-[var(--app-text)]">{pkg.forks}</span></div>
          </>
        ) : (
          <>
            <div className="truncate"><span className="text-[var(--app-text-muted)] opacity-70">ID:</span> <span className="font-mono text-[var(--app-text)]">{pkg.id}</span></div>
            <div className="truncate text-right"><span className="text-[var(--app-text-muted)] opacity-70">Ver:</span> <span className="font-mono text-[var(--app-text)]">{pkg.availableVersion || pkg.version || '?'}</span></div>
          </>
        )}
      </div>

      {!settings.compactMode && (
        <div className="flex-grow mb-2 flex flex-col min-h-0">
          <div className={`flex-1 pr-1 ${isExpanded ? 'max-h-40 overflow-y-auto' : 'overflow-hidden'}`}>
            <p className={`text-xs text-[var(--app-text-muted)] leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>{pkg.description}</p>
            {isExpanded && (
              <div className="mt-3 bg-[var(--app-primary)]/5 p-2 rounded border border-[var(--app-primary)]/20 animate-in fade-in slide-in-from-top-1">
                {loadingSummary ? (
                  <div className="flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
                    <Loader2 size={12} className="animate-spin" /> Analyzing...
                  </div>
                ) : (
                  <p className="text-xs italic text-[var(--app-text)] whitespace-pre-wrap">{aiSummary}</p>
                )}
              </div>
            )}
          </div>
          <button onClick={toggleExpand} className="shrink-0 text-[10px] text-[var(--app-primary)] mt-1 flex items-center gap-1 w-full justify-center hover:bg-[var(--app-bg)] rounded py-0.5">{isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}</button>
        </div>
      )}

      <div className="mt-auto space-y-2 shrink-0">
        {(pkg.source === 'github' || settings.activePackageManager === 'github') ? (
          <div className="grid grid-cols-7 gap-1">
            <button onClick={() => setPendingChatQuery(generateAppDetailsPrompt(pkg.name, pkg.id))} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-primary)] text-[10px]" title="Ask AI"><Sparkles size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); onGitHubAction?.(pkg.id, 'star'); }} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-amber-400 text-[10px]" title="Star/Unstar">
              <Star size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onGitHubAction?.(pkg.id, 'fork'); }} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-primary)] text-[10px]" title="Fork Repo">
              <GitFork size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onGitHubAction?.(pkg.id, 'watch'); }} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-blue-400 text-[10px]" title="Watch/Unwatch">
              <Eye size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onGitHubAction?.(pkg.id, 'details'); }} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-emerald-400 text-[10px]" title="Repo Details">
              <Info size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onGitHubAction?.(pkg.id, 'open'); }} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-text)] text-[10px]" title="View on GitHub">
              <ExternalLink size={14} />
            </button>
            <button onClick={handleCopy} className={`flex items-center justify-center py-1 rounded text-[10px] transition-colors ${showCopied ? 'bg-green-500/20 text-green-500' : 'bg-[var(--app-bg)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`} title="Copy Clone Command">
              <Terminal size={14} />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1">
            <button onClick={() => setPendingChatQuery(generateAppDetailsPrompt(pkg.name, pkg.id))} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-primary)] text-[10px]" title="Ask AI"><Sparkles size={14} /></button>
            <button onClick={() => { setMode('install'); handleSearch(generateAlternativesPrompt(pkg.name)); }} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-primary)] text-[10px]" title="Alternatives"><GitFork size={14} /></button>
            <button onClick={() => setPendingChatQuery(generateEvaluationPrompt(pkg.name))} className="flex items-center justify-center py-1 bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-[var(--app-primary)] text-[10px]" title="Review"><Star size={14} /></button>
            <button onClick={() => toggleCompare(pkg)} className={`flex items-center justify-center py-1 rounded text-[10px] transition-colors ${isInCompare ? 'bg-[var(--app-primary)] text-white' : 'bg-[var(--app-bg)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`} title="Compare"><Scale size={14} /></button>
            <button onClick={handleCopy} className={`flex items-center justify-center py-1 rounded text-[10px] transition-colors ${showCopied ? 'bg-green-500/20 text-green-500' : 'bg-[var(--app-bg)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'}`}><Terminal size={14} /></button>
          </div>
        )}

        <div className="flex gap-2">
          {isDesktop ? (
            <>
              <button
                onClick={handleExecute}
                disabled={isExecuting}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-md ${config.btnClass} ${isExecuting ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {isExecuting ? <Loader2 size={16} className="animate-spin" /> : config.icon}
                <span>{isExecuting ? 'Processing...' : `${config.text} Now`}</span>
              </button>
              <button
                onClick={() => {
                  if (config.disabled) return;
                  handleToggleCart();
                }}
                disabled={config.disabled}
                className={`px-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-primary)] transition-colors ${isInCart ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)] border-[var(--app-primary)]' : ''} ${config.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isInCart ? "Remove from Cart" : "Add to Cart"}
              >
                {isInCart ? <Check size={16} /> : <Plus size={16} />}
                <span>{isInCart ? 'Added' : 'Add'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (config.disabled) return;
                handleToggleCart();
              }}
              disabled={config.disabled}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-all shadow-md ${config.btnClass} ${config.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isInCart ? <Check size={16} /> : config.icon} <span>{config.text}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
