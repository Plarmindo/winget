
import React, { useState } from 'react';
import { X, Search, Download, Terminal, Settings, Accessibility, PlayCircle, MousePointer, Keyboard, ChevronRight, HelpCircle, Image } from 'lucide-react';

interface HelpStep {
  title: string;
  description: string;
  // In a real app, this would be a path to a GIF/Image like '/assets/help/search.gif'
  // For this demo, we use a placeholder visualizer
  visualType: 'search' | 'cart' | 'script' | 'ai' | 'settings'; 
}

interface HelpTopic {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  steps: HelpStep[];
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTopicId, setActiveTopicId] = useState('getting-started');

  if (!isOpen) return null;

  const HELP_TOPICS: HelpTopic[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: <PlayCircle size={20} />,
      description: 'Learn the basics of how to find software and why this app exists.',
      steps: [
        {
          title: 'What is this app?',
          description: 'This application helps you download software easily. Instead of going to many different websites, you can find everything here.',
          visualType: 'search'
        },
        {
          title: 'Choose your Mode',
          description: 'Use the buttons at the top to switch modes: "Install" to get new apps, "Upgrade" to update existing ones, or "Uninstall" to remove them.',
          visualType: 'settings'
        }
      ]
    },
    {
      id: 'search-install',
      title: 'Find & Install Apps',
      icon: <Search size={20} />,
      description: 'How to search for applications and add them to your list.',
      steps: [
        {
          title: 'Search for an App',
          description: 'Click the Search Bar at the top. Type the name of the program (e.g., "Chrome" or "Spotify") and press Enter.',
          visualType: 'search'
        },
        {
          title: 'Select Packages',
          description: 'Click the checkbox (Square icon) next to the apps you want. Or click "Add" to put them in your cart.',
          visualType: 'cart'
        }
      ]
    },
    {
      id: 'generate-script',
      title: 'Create Script',
      icon: <Terminal size={20} />,
      description: 'Turn your selected apps into a downloadable installer file.',
      steps: [
        {
          title: 'Open the Cart',
          description: 'Click the Shopping Bag icon in the top right corner to see your selected apps.',
          visualType: 'cart'
        },
        {
          title: 'Generate',
          description: 'Click the "Generate Script" button. You can then copy the code or download a file to run on your computer.',
          visualType: 'script'
        }
      ]
    },
    {
      id: 'accessibility',
      title: 'Accessibility',
      icon: <Accessibility size={20} />,
      description: 'Features to make the app easier to use.',
      steps: [
        {
          title: 'Keyboard Shortcuts',
          description: 'Press Ctrl+K to open the Command Palette. Use Tab to move between buttons. Use Arrow Keys to navigate lists.',
          visualType: 'settings'
        },
        {
          title: 'Visual Aids',
          description: 'Go to Settings to enable "High Contrast Mode" or "Reduced Motion" if the animations are distracting.',
          visualType: 'settings'
        }
      ]
    }
  ];

  const activeTopic = HELP_TOPICS.find(t => t.id === activeTopicId) || HELP_TOPICS[0];

  // A mock component to simulate where a GIF would go
  const VisualPlaceholder = ({ type }: { type: string }) => {
    let content = null;
    let colorClass = "bg-[var(--app-primary)]/10 text-[var(--app-primary)]";
    
    switch(type) {
        case 'search': 
            content = <div className="flex flex-col items-center gap-2"><div className="w-3/4 h-8 border rounded-full bg-[var(--app-surface)] flex items-center px-3 text-xs text-muted">Search apps...</div><MousePointer className="animate-bounce mt-2" size={24} /></div>;
            break;
        case 'cart':
            content = <div className="flex items-center gap-4"><div className="p-4 border rounded bg-[var(--app-surface)]">App A</div><ChevronRight /><div className="p-4 border rounded-full bg-[var(--app-primary)] text-white"><Download size={20} /></div></div>;
            break;
        case 'script':
            content = <div className="w-full h-24 bg-black/80 rounded p-2 font-mono text-[10px] text-green-400 text-left">winget install...<br/>&gt; Downloading...<br/>&gt; Installing...</div>;
            break;
        case 'settings':
             content = <div className="flex gap-2"><div className="w-8 h-8 rounded bg-gray-500/20"></div><div className="w-8 h-8 rounded bg-[var(--app-primary)]"></div></div>;
             break;
        default:
            content = <Image size={32} />;
    }

    return (
        <div className={`w-full h-40 rounded-xl border-2 border-dashed border-[var(--app-border)] flex items-center justify-center ${colorClass} mb-4 relative overflow-hidden`}>
            {content}
            <div className="absolute bottom-2 right-2 text-[10px] bg-[var(--app-bg)] px-2 py-1 rounded opacity-70">
                Visualization
            </div>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex overflow-hidden text-[var(--app-text)]" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Sidebar */}
        <div className="w-64 bg-[var(--app-bg)]/50 border-r border-[var(--app-border)] flex flex-col">
            <div className="p-6 border-b border-[var(--app-border)]">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <HelpCircle className="text-[var(--app-primary)]" /> Help Center
                </h2>
                <p className="text-xs text-[var(--app-text-muted)] mt-1">Guides & Walkthroughs</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {HELP_TOPICS.map(topic => (
                    <button
                        key={topic.id}
                        onClick={() => setActiveTopicId(topic.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                            activeTopicId === topic.id 
                            ? 'bg-[var(--app-primary)] text-white shadow-lg shadow-blue-900/20' 
                            : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]'
                        }`}
                    >
                        {topic.icon}
                        <span className="font-medium text-sm">{topic.title}</span>
                    </button>
                ))}
            </div>
             <div className="p-4 border-t border-[var(--app-border)] text-xs text-[var(--app-text-muted)] text-center">
                 Need more help?<br/> Ask the AI Assistant.
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--app-surface)]">
            <div className="p-6 border-b border-[var(--app-border)] flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold mb-1">{activeTopic.title}</h1>
                    <p className="text-[var(--app-text-muted)]">{activeTopic.description}</p>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 hover:bg-[var(--app-bg)] rounded-full text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                >
                    <X size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-12">
                    {activeTopic.steps.map((step, index) => (
                        <div key={index} className="flex gap-6 relative group">
                            {/* Step Number Line */}
                            <div className="flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full bg-[var(--app-primary)] text-white flex items-center justify-center font-bold text-lg shadow-lg z-10">
                                    {index + 1}
                                </div>
                                {index !== activeTopic.steps.length - 1 && (
                                    <div className="w-0.5 flex-1 bg-[var(--app-border)] my-2 group-hover:bg-[var(--app-primary)]/50 transition-colors"></div>
                                )}
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 pb-8">
                                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                                <VisualPlaceholder type={step.visualType} />
                                <div className="bg-[var(--app-bg)] p-4 rounded-xl border border-[var(--app-border)] text-sm leading-relaxed text-[var(--app-text-muted)]">
                                    {step.description}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
