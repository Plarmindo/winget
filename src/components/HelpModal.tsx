
import React, { useState, useMemo } from 'react';
import {
  X, Search, Download, Terminal, PlayCircle,
  ChevronRight, HelpCircle, Image, AlertTriangle,
  ChevronDown, Check, ExternalLink, Github, Star,
  Cpu, FileText, Scale, Settings, Layers, RefreshCw, Trash2, Box
} from 'lucide-react';

interface HelpAction {
  label: string;
  action?: 'settings' | 'install' | 'upgrade' | 'github';
  url?: string;
}

interface HelpStep {
  title: string;
  description: string;
  visualType?: 'search' | 'cart' | 'script' | 'ai-summary' | 'ai-chat' | 'modes' | 'github-connect' | 'github-compare' | 'compare-mode' | 'providers' | 'upgrade' | 'uninstall';
  action?: HelpAction;
}

interface HelpTopic {
  id: string;
  title: string;
  category: 'guide' | 'advanced' | 'github' | 'faq' | 'troubleshooting';
  icon: React.ReactNode;
  description: string;
  steps: HelpStep[];
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onOpenSettings }) => {
  const [activeTopicId, setActiveTopicId] = useState<string>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const HELP_TOPICS: HelpTopic[] = [
    // --- ESSENTIALS ---
    {
      id: 'getting-started',
      category: 'guide',
      title: 'Getting Started',
      icon: <PlayCircle size={18} />,
      description: 'Master the basics of Winget UI in 2 minutes.',
      steps: [
        {
          title: 'What is Winget UI?',
          description: 'It is a power-user interface for the official Windows Package Manager (winget). We unify multiple sources to let you manage software easily.',
          visualType: 'search'
        },
        {
          title: 'Installation Modes',
          description: 'Use the top navigation bar to switch between main tasks:\n• Discover: Find and install new apps.\n• Upgrades: Check for newer versions of your installed software.\n• Installed: View and remove (uninstall) existing apps.',
          visualType: 'modes'
        }
      ]
    },
    {
      id: 'finding-apps',
      category: 'guide',
      title: 'Find & Install',
      icon: <Search size={18} />,
      description: 'Search globally across multiple providers.',
      steps: [
        {
          title: 'Unified Providers',
          description: 'When you search, we query both the "Winget" repository (community maintained) and the "Microsoft Store" simultaneously. You choose the best source.',
          visualType: 'providers'
        },
        {
          title: 'Smart Search',
          description: 'Just type! Use keywords like "vscode" or "browser". You can also search by ID (e.g., "Mozilla.Firefox") for precision.',
          visualType: 'search'
        },
        {
          title: 'Bulk Selection',
          description: 'Don\'t install one by one. Check the boxes next to multiple apps to add them to your cart, then install them all at once.',
          visualType: 'cart'
        }
      ]
    },
    {
      id: 'upgrade-uninstall',
      category: 'guide',
      title: 'Upgrade & Uninstall',
      icon: <RefreshCw size={18} />,
      description: 'Keep your system clean and up-to-date.',
      steps: [
        {
          title: 'Upgrading Apps',
          description: 'Switch to the "Upgrades" tab. We scan your system for outdated apps. Click "Upgrade All" to update everything in one click.',
          visualType: 'upgrade'
        },
        {
          title: 'Uninstalling',
          description: 'Go to the "Installed" tab to see everything on your PC. Click the trash icon next to any app to remove it cleanly.',
          visualType: 'uninstall'
        }
      ]
    },

    // --- GITHUB INTEGRATION ---
    {
      id: 'github-integration',
      category: 'github',
      title: 'GitHub Integration',
      icon: <Github size={18} />,
      description: 'Install directly from developer repositories.',
      steps: [
        {
          title: 'Connect Mode',
          description: 'Switch to the "GitHub" tab. This lets you search for any repository on GitHub.',
          visualType: 'github-connect'
        },
        {
          title: 'User Repositories',
          description: 'Not just popular apps! You can type "user/repo" (e.g., "marticliment/WingetUI") to access specific repositories that might not be in the main gallery.',
          action: { label: 'Try GitHub Search', action: 'github' }
        },
        {
          title: 'Hybrid Comparison',
          description: 'Compare a GitHub repo against a standard Winget package to decide between the stable release or the bleeding-edge source.',
          visualType: 'github-compare'
        }
      ]
    },

    // --- ADVANCED FEATURES ---
    {
      id: 'ai-power',
      category: 'advanced',
      title: 'AI Superpowers',
      icon: <Cpu size={18} />,
      description: 'Using the built-in LLM to analyze software.',
      steps: [
        {
          title: 'Instant Summaries',
          description: 'Expand any card to see an AI-generated summary. We read the manifest and description to tell you what the app REALLY does.',
          visualType: 'ai-summary'
        },
        {
          title: 'Contextual Chat',
          description: 'Open the sidebar chat to ask complex questions like "Which video editor is best for 4K?" or "Explain the difference between these two git clients".',
          visualType: 'ai-chat'
        }
      ]
    },
    {
      id: 'scripting',
      category: 'advanced',
      title: 'Script Generation',
      icon: <FileText size={18} />,
      description: 'Automate your setup process.',
      steps: [
        {
          title: 'The Cart Concept',
          description: 'Every app you select is added to your efficient "Shopping Cart". Open it via the header icon.',
          visualType: 'cart'
        },
        {
          title: 'Export to Batch/PowerShell',
          description: 'In the cart, use "Generate Script" to get a .bat or .ps1 file. Run this file on a fresh Windows installation to auto-install your entire suite.',
          visualType: 'script'
        }
      ]
    },
    {
      id: 'comparison',
      category: 'advanced',
      title: 'Compare Mode',
      icon: <Scale size={18} />,
      description: 'Side-by-side feature analysis.',
      steps: [
        {
          title: 'Activate Comparison',
          description: 'Click the "Scales" icon on any package card. A comparison bar will appear at the bottom.',
          visualType: 'compare-mode'
        },
        {
          title: 'Analyze',
          description: 'Add up to 4 apps. Click "Compare" to generate a detailed table comparing features, license, size, and AI-generated pros/cons.'
        }
      ]
    },

    // --- TROUBLESHOOTING ---
    {
      id: 'common-errors',
      category: 'troubleshooting',
      title: 'Troubleshooting',
      icon: <AlertTriangle size={18} />,
      description: 'Solutions for common hiccups.',
      steps: [
        {
          title: 'Winget Not Recognized',
          description: 'Ensure "App Installer" is updated in the Microsoft Store. This app relies on the core Winget CLI tool.',
          action: { label: 'Get App Installer', url: 'ms-windows-store://pdp/?productid=9nblggh4nns1' }
        },
        {
          title: 'GitHub API Limits',
          description: 'If GitHub search stops working, you have hit the unauthenticated rate limit. Go to Settings and add a Personal Access Token to increase your limit significantly.',
          action: { label: 'Add Token', action: 'settings' }
        }
      ]
    },

    // --- FAQ ---
    {
      id: 'faq',
      category: 'faq',
      title: 'FAQ',
      icon: <HelpCircle size={18} />,
      description: 'Quickfire answers.',
      steps: [
        { title: 'Is it safe?', description: 'Yes. All packages come from the official Microsoft Winget repository or the Microsoft Store. We effectively just run the command line for you.' },
        { title: 'Can I backup my current apps?', description: 'Currently we support exporting a list of *new* installations. Full system backup is planned for v2.0.' },
        { title: 'Why is AI required?', description: 'It is optional! You can use the app without AI, but summaries and chat features will be disabled. You can use local LLMs via Ollama for privacy.' },
        { title: 'Where is the dark mode?', description: 'In Settings! We respect your system preference by default but you can force Dark/Light mode.', action: { label: 'Change Theme', action: 'settings' } }
      ]
    }
  ];

  // Search Logic
  const filteredTopics = useMemo(() => {
    if (!searchQuery) return HELP_TOPICS;
    const lowerQ = searchQuery.toLowerCase();
    return HELP_TOPICS.filter(t =>
      t.title.toLowerCase().includes(lowerQ) ||
      t.description.toLowerCase().includes(lowerQ) ||
      t.steps.some(s => s.title.toLowerCase().includes(lowerQ) || s.description.toLowerCase().includes(lowerQ))
    );
  }, [searchQuery]);

  // MOVED THIS CHECK AFTER HOOKS to avoid "Rendered more hooks" error
  if (!isOpen) return null;

  const activeTopic = HELP_TOPICS.find(t => t.id === activeTopicId) || HELP_TOPICS[0];

  // Categorize for sidebar
  const categories = {
    guide: filteredTopics.filter(t => t.category === 'guide'),
    github: filteredTopics.filter(t => t.category === 'github'),
    advanced: filteredTopics.filter(t => t.category === 'advanced'),
    troubleshooting: filteredTopics.filter(t => t.category === 'troubleshooting'),
    faq: filteredTopics.filter(t => t.category === 'faq')
  };

  const handleAction = (action?: HelpAction) => {
    if (!action) return;
    if (action.action === 'settings' && onOpenSettings) {
      onOpenSettings();
      // onClose(); // Optional: keep open
    } else if (action.url) {
      window.open(action.url, '_blank');
    }
  };

  // --- VISUAL ELEMENTS (CSS Animations) ---
  const VisualContent = ({ type }: { type?: string }) => {
    switch (type) {
      case 'modes':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900/50 p-4">
            <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
              <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold">Discover</div>
              <div className="px-3 py-1 text-gray-400 text-[10px] font-medium">Upgrades</div>
              <div className="px-3 py-1 text-gray-400 text-[10px] font-medium">Installed</div>
              <div className="px-3 py-1 text-gray-400 text-[10px] font-medium border-l border-gray-200 dark:border-gray-700 ml-1 pl-2 flex items-center gap-1">
                <Github size={8} /> GitHub
              </div>
            </div>
            <div className="absolute mt-12 animate-bounce">
              <div className="px-2 py-1 bg-black text-white text-[10px] rounded mb-1">Select logic here</div>
              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-black mx-auto"></div>
            </div>
          </div>
        );
      case 'providers':
        return (
          <div className="flex items-center justify-center gap-8 h-full bg-gray-50 dark:bg-gray-900/50 relative overflow-hidden">
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Terminal size={24} />
              </div>
              <span className="text-[10px] font-mono opacity-50">Winget</span>
            </div>
            <div className="h-0.5 w-16 bg-gray-300 dark:bg-gray-700 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-2 text-[8px] text-gray-400 font-bold border border-gray-200 dark:border-gray-700 rounded-full">ALL IN ONE</div>
            </div>
            <div className="flex flex-col items-center gap-2 z-10">
              <div className="w-12 h-12 bg-white text-black border border-gray-200 rounded-xl flex items-center justify-center shadow-lg relative">
                <Box size={24} className="text-blue-600" />
                <div className="absolute top-0 right-0 w-3 h-3 bg-gradient-to-tr from-yellow-400 to-red-500 -m-1 rounded-full"></div>
              </div>
              <span className="text-[10px] font-mono opacity-50">Store</span>
            </div>
          </div>
        );
      case 'upgrade':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900/50">
            <div className="relative">
              <div className="w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-md"></div>
                  <div className="flex flex-col">
                    <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="w-8 h-1.5 bg-gray-100 dark:bg-gray-700/50 rounded mt-1"></div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-[10px] text-gray-400 line-through">v1.2.0</div>
                  <div className="text-[10px] text-green-500 font-bold flex items-center gap-0.5">
                    v2.0.0 <Check size={8} />
                  </div>
                </div>
              </div>
              <div className="absolute -right-2 -top-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>
            </div>
          </div>
        );
      case 'uninstall':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900/50">
            <div className="w-32 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/30 rounded-lg p-3 shadow-md flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-md"></div>
                <div className="w-12 h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="p-1.5 bg-red-100 dark:bg-red-900/20 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors cursor-pointer">
                <Trash2 size={12} />
              </div>
            </div>
          </div>
        );
      case 'search':
        return (
          <div className="flex flex-col items-center justify-center h-full sm:h-48 w-full relative overflow-hidden bg-gray-50 dark:bg-gray-900/50">
            <div className="absolute top-4 w-3/4 h-8 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex items-center px-3 gap-2 animate-pulse">
              <Search size={14} className="text-gray-400" />
              <div className="h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="mt-8 flex gap-2">
              <div className="w-20 h-24 bg-white dark:bg-gray-800 border-2 border-primary/20 rounded-lg shadow-sm flex flex-col p-2 gap-1 animate-bounce duration-1000">
                <div className="w-8 h-8 rounded bg-blue-100 self-center"></div>
                <div className="h-1 w-full bg-gray-100 rounded mt-1"></div>
              </div>
              <div className="w-20 h-24 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm flex flex-col p-2 gap-1 opacity-50 scale-90">
                <div className="w-8 h-8 rounded bg-orange-100 self-center"></div>
              </div>
            </div>
          </div>
        );
      case 'cart':
        return (
          <div className="flex items-center justify-center gap-4 h-full bg-gray-50 dark:bg-gray-900/50">
            <div className="relative group cursor-pointer">
              <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm group-hover:-translate-y-1 transition-transform">
                <div className="w-8 h-8 bg-blue-500 rounded-lg"></div>
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-gray-800 shadow-sm animate-in zoom-in">
                <Check size={12} strokeWidth={3} />
              </div>
            </div>
            <ChevronRight className="text-gray-300" />
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary border-2 border-primary border-dashed">
              <Download size={24} />
            </div>
          </div>
        );
      case 'ai-summary':
      case 'ai-chat':
        return (
          <div className="p-4 flex flex-col gap-3 max-w-[240px] w-full mx-auto bg-gray-50 dark:bg-gray-900/50 h-full justify-center">
            <div className="flex gap-2 items-end self-start w-3/4">
              <div className="w-6 h-6 rounded-full bg-purple-600 shrink-0 flex items-center justify-center text-[8px] text-white">AI</div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-2xl rounded-bl-sm text-[10px] text-purple-900 dark:text-purple-100 leading-tight">
                {type === 'ai-summary' ? 'This package contains the VS Code editor...' : 'The best option for 4K video editing is...'}
              </div>
            </div>
            <div className="flex gap-2 items-end self-end w-2/3">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-2xl rounded-br-sm text-[10px] text-blue-900 dark:text-blue-100 leading-tight">
                {type === 'ai-summary' ? 'Tell me more!' : 'What about audio?'}
              </div>
              <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0"></div>
            </div>
          </div>
        );
      case 'github-connect':
        return (
          <div className="flex items-center justify-center gap-6 h-full bg-gray-50 dark:bg-gray-900/50">
            <div className="w-16 h-16 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black shadow-lg">
              <Github size={32} />
            </div>
            <div className="h-1 w-12 bg-gradient-to-r from-gray-400 to-blue-500 rounded-full animate-pulse"></div>
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Terminal size={32} />
            </div>
          </div>
        );
      case 'github-compare':
        return (
          <div className="flex items-center justify-center gap-2 h-full bg-gray-50 dark:bg-gray-900/50">
            <div className="w-20 h-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-sm scale-90 origin-right">
              <div className="flex justify-between mb-2"><Github size={12} /><Star size={12} className="text-yellow-400" /></div>
              <div className="h-1 w-full bg-gray-100 dark:bg-gray-700 rounded mb-1"></div>
              <div className="h-1 w-2/3 bg-gray-100 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="z-10 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
              <Scale size={20} className="text-primary" />
            </div>
            <div className="w-20 h-28 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-sm scale-90 origin-left border-l-4 border-l-blue-500">
              <div className="flex justify-between mb-2"><div className="w-4 h-4 bg-blue-500 rounded"></div></div>
              <div className="h-1 w-full bg-gray-100 dark:bg-gray-700 rounded mb-1"></div>
            </div>
          </div>
        );
      case 'compare-mode':
        return (
          <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900/50">
            <div className="flex gap-1 items-end">
              <div className="w-8 h-12 bg-blue-200 rounded-sm"></div>
              <div className="w-8 h-16 bg-blue-500 rounded-sm"></div>
              <div className="w-8 h-10 bg-blue-300 rounded-sm"></div>
            </div>
          </div>
        );
      case 'script':
        return (
          <div className="w-full h-full bg-[#1e1e1e] p-4 font-mono text-[10px] text-gray-300 overflow-hidden flex flex-col font-mono leading-relaxed">
            <div className="flex gap-1.5 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
            </div>
            <div className="opacity-50 mb-2"># Generated by WingetUI</div>
            <div><span className="text-green-400">winget</span> install --id "Mozilla.Firefox"</div>
            <div><span className="text-blue-400">Downloading</span> Mozilla Firefox...</div>
            <div className="text-gray-500 italic">█ 45% [====----]</div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-300 bg-gray-50 dark:bg-gray-900/50">
            <Image size={48} />
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-[var(--app-surface)] w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex border border-[var(--app-border)] overflow-hidden text-[var(--app-text)]"
        onClick={e => e.stopPropagation()}
      >

        {/* SIDEBAR */}
        <div className="w-72 bg-[var(--app-bg)] border-r border-[var(--app-border)] flex flex-col shrink-0">
          <div className="p-5 border-b border-[var(--app-border)]">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <HelpCircle className="text-[var(--app-primary)]" /> Help Center
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" size={14} />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--app-primary)] transition-shadow"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-6">
            {Object.entries(categories).map(([cat, topics]) => (
              topics.length > 0 && (
                <div key={cat}>
                  <h3 className="px-3 text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-wider mb-2 opacity-80">
                    {cat.replace('-', ' ')}
                  </h3>
                  <div className="space-y-1">
                    {topics.map(topic => (
                      <button
                        key={topic.id}
                        onClick={() => setActiveTopicId(topic.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${activeTopicId === topic.id
                            ? 'bg-[var(--app-primary)] text-white shadow-md shadow-[var(--app-primary)]/20 translate-x-1'
                            : 'text-[var(--app-text)] hover:bg-[var(--app-surface)] hover:translate-x-0.5'
                          }`}
                      >
                        <span className={activeTopicId === topic.id ? 'text-white' : 'text-[var(--app-text-muted)]'}>{topic.icon}</span>
                        <span className="font-medium truncate">{topic.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            ))}
            {Object.values(categories).every(c => c.length === 0) && (
              <div className="text-center p-8 flex flex-col items-center gap-3 text-[var(--app-text-muted)]">
                <Search size={24} className="opacity-20" />
                <p className="text-sm">No topics match your search.</p>
                <button onClick={() => setSearchQuery('')} className="text-xs text-[var(--app-primary)] hover:underline">Clear search</button>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-bg)]/50">
            <button onClick={() => window.open('https://github.com/marticliment/WingetUI', '_blank')} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[var(--app-border)] text-xs font-medium text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] transition-colors">
              <ExternalLink size={14} /> View Project on GitHub
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col h-full bg-[var(--app-surface)] relative overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-[var(--app-border)] flex justify-between items-start bg-[var(--app-bg)]/10 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${activeTopic.category === 'troubleshooting' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    activeTopic.category === 'advanced' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                      activeTopic.category === 'github' ? 'bg-gray-500/10 text-gray-500 border-gray-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  }`}>
                  {activeTopic.category}
                </span>
                <span className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">•</span>
                <span className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider">Estimated Read: 1 min</span>
              </div>
              <h1 className="text-3xl font-bold text-[var(--app-text)] mb-2 tracking-tight">{activeTopic.title}</h1>
              <p className="text-[var(--app-text-muted)] text-base leading-relaxed">{activeTopic.description}</p>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 -mt-2 rounded-full hover:bg-[var(--app-border)] transition-colors" aria-label="Close Help">
              <X size={24} className="text-[var(--app-text-muted)]" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto pb-12">

              {activeTopic.category === 'faq' ? (
                <div className="grid gap-4">
                  {activeTopic.steps.map((step, i) => (
                    <div key={i} className="border border-[var(--app-border)] rounded-xl overflow-hidden bg-[var(--app-surface)] hover:border-[var(--app-primary)]/30 transition-colors shadow-sm">
                      <button
                        className="w-full flex items-center justify-between p-5 text-left font-semibold text-[var(--app-text)] hover:bg-[var(--app-bg)]/50 transition-colors"
                        onClick={() => setExpandedFaq(expandedFaq === i.toString() ? null : i.toString())}
                      >
                        {step.title}
                        <div className={`w-6 h-6 rounded-full bg-[var(--app-bg)] flex items-center justify-center transition-transform duration-300 ${expandedFaq === i.toString() ? 'rotate-180 bg-[var(--app-primary)] text-white' : ''}`}>
                          <ChevronDown size={14} />
                        </div>
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedFaq === i.toString() ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-5 pt-0 text-sm leading-relaxed text-[var(--app-text-muted)] border-t border-[var(--app-border)]/50 bg-[var(--app-bg)]/20">
                          <div className="pt-4">{step.description}</div>
                          {step.action && (
                            <button
                              onClick={() => handleAction(step.action)}
                              className="mt-4 text-xs font-bold text-[var(--app-primary)] hover:underline flex items-center gap-1 uppercase tracking-wide"
                            >
                              {step.action.label} <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-16">
                  {activeTopic.steps.map((step, index) => (
                    <div key={index} className="flex gap-8 group">
                      {/* Number Column */}
                      <div className="flex flex-col items-center pt-2">
                        <div className="w-10 h-10 rounded-xl bg-[var(--app-surface)] border-2 border-[var(--app-border)] text-[var(--app-text-muted)] group-hover:bg-[var(--app-primary)] group-hover:text-white group-hover:border-[var(--app-primary)] transition-all duration-300 flex items-center justify-center font-bold text-lg shadow-sm z-10">
                          {index + 1}
                        </div>
                        {index !== activeTopic.steps.length - 1 && (
                          <div className="w-0.5 h-full bg-[var(--app-border)] my-4 group-hover:bg-[var(--app-primary)]/20 transition-colors rounded-full"></div>
                        )}
                      </div>

                      {/* Content Column */}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-3 text-[var(--app-text)]">{step.title}</h3>

                        {step.visualType && (
                          <div className="mb-6 h-56 rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)]/30 overflow-hidden relative shadow-inner group-hover:shadow-md transition-shadow duration-500">
                            <VisualContent type={step.visualType} />
                          </div>
                        )}

                        <p className="text-[var(--app-text-muted)] leading-relaxed whitespace-pre-wrap">{step.description}</p>

                        {step.action && (
                          <button
                            onClick={() => handleAction(step.action)}
                            className="mt-5 px-5 py-2.5 bg-[var(--app-primary)] text-white text-sm font-medium rounded-lg hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-lg shadow-[var(--app-primary)]/20 active:scale-95 flex items-center gap-2 group/btn"
                          >
                            {step.action.label} <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-[var(--app-border)] flex justify-between items-center text-xs text-[var(--app-text-muted)]">
              <span>Was this helpful?</span>
              <div className="flex gap-4">
                <button className="hover:text-[var(--app-primary)] flex items-center gap-1 transition-colors"><Check size={14} /> Yes</button>
                <button className="hover:text-red-500 flex items-center gap-1 transition-colors"><X size={14} /> No</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
