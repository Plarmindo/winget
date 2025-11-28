import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, XCircle } from 'lucide-react';
import { POPULAR_SUGGESTIONS, STORAGE_KEYS } from '../constants';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  onStop?: () => void;
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onSearch,
  onStop,
  loading,
  placeholder = "Search packages...",
  autoFocus,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
      if (saved) {
        setHistory(JSON.parse(saved).slice(0, 5));
      }
    } catch (e) {
      console.error("Failed to load search history", e);
    }
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (term: string) => {
    if (!term.trim() || term === "POPULAR_ESSENTIALS") return;
    const newHistory = [term, ...history.filter(h => h !== term)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(newHistory));
  };

  const handleSubmit = (term: string) => {
    setIsOpen(false);
    saveToHistory(term);
    onSearch(term);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > -1 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        onChange(suggestions[activeIndex].text);
        handleSubmit(suggestions[activeIndex].text);
      } else {
        handleSubmit(value);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Filter and merge suggestions
  const getSuggestions = () => {
    const normalizedValue = value.toLowerCase().trim();
    
    // 1. History Matches
    const historyMatches = history
      .filter(item => item.toLowerCase().includes(normalizedValue))
      .map(item => ({ type: 'history' as const, text: item }));

    // 2. Popular Suggestions Matches (exclude items already in history to avoid dupes)
    const popularMatches = POPULAR_SUGGESTIONS
      .filter(item => 
        item.toLowerCase().includes(normalizedValue) && 
        !history.some(h => h.toLowerCase() === item.toLowerCase())
      )
      .slice(0, 8)
      .map(item => ({ type: 'popular' as const, text: item }));

    return [...historyMatches, ...popularMatches];
  };

  const suggestions = getSuggestions();
  const showDropdown = isOpen && (suggestions.length > 0 || (value === '' && history.length > 0));

  // Helper to highlight matching text
  const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span key={i} className="text-[var(--app-primary)] font-bold">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value === "POPULAR_ESSENTIALS" ? "" : value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-[var(--app-bg)] border border-[var(--app-border)] rounded-full py-2 pl-12 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent placeholder-[var(--app-text-muted)] text-[var(--app-text)] transition-all shadow-sm"
          autoComplete="off"
        />
        <Search className="absolute left-4 top-2.5 text-[var(--app-text-muted)]" size={18} />
        
        {loading ? (
          <button 
            onClick={onStop} 
            className="absolute right-3 top-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors" 
            title="Stop Search"
          >
            <XCircle size={16} />
          </button>
        ) : (
          value && value !== "POPULAR_ESSENTIALS" && (
            <button 
              onClick={() => {
                onChange('');
                setIsOpen(true);
                inputRef.current?.focus();
              }} 
              className="absolute right-3 top-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors" 
              title="Clear Search"
            >
              <X size={16} />
            </button>
          )
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[400px] overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={`${suggestion.type}-${suggestion.text}`}
              onClick={() => {
                onChange(suggestion.text);
                handleSubmit(suggestion.text);
              }}
              className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 transition-colors ${
                idx === activeIndex 
                  ? 'bg-[var(--app-primary)]/10 text-[var(--app-text)]' 
                  : 'text-[var(--app-text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--app-text)]'
              }`}
            >
              {suggestion.type === 'history' ? (
                <Clock size={14} className="text-[var(--app-text-muted)] shrink-0" />
              ) : (
                <TrendingUp size={14} className="text-[var(--app-primary)] shrink-0" />
              )}
              <span className="truncate">
                <HighlightedText text={suggestion.text} highlight={value} />
              </span>
            </button>
          ))}
          {history.length > 0 && (
             <div className="border-t border-[var(--app-border)] p-2 bg-[var(--app-bg)]/50">
               <button 
                  onClick={() => {
                     setHistory([]);
                     localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
                  }}
                  className="w-full text-xs text-center text-[var(--app-text-muted)] hover:text-red-400 transition-colors"
               >
                  Clear History
               </button>
             </div>
          )}
        </div>
      )}
    </div>
  );
};