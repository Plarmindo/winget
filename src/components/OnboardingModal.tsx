import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Check, Zap, Github, Download, Terminal } from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay for animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Allow exit animation
  };

  const steps = [
    {
      title: 'Welcome to Winget UI',
      desc: 'Your new command center for Windows software. Manage apps, discover tools, and automate installations with the power of Winget and AI.',
      icon: <Terminal size={64} className="text-blue-500" />,
      color: 'bg-blue-500',
    },
    {
      title: 'Unified Package Management',
      desc: 'Search once, find everywhere. We combine Winget, Microsoft Store, and Chocolatey into one seamless interface. Install, upgrade, and uninstall with a single click.',
      icon: <Download size={64} className="text-emerald-500" />,
      color: 'bg-emerald-500',
    },
    {
      title: 'AI Superpowers',
      desc: 'Not sure what to install? Ask our AI assistant to compare apps, write install scripts, or explain what a package does. It works with Gemini, OpenAI, or local Ollama models.',
      icon: <Zap size={64} className="text-amber-500" />,
      color: 'bg-amber-500',
    },
    {
      title: 'GitHub Integration',
      desc: 'Connect your GitHub account to star, fork, and install repositories directly. We treat GitHub repos just like native packages.',
      icon: <Github size={64} className="text-purple-500" />,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div
        className={`relative bg-[var(--app-surface)] text-[var(--app-text)] w-full max-w-lg rounded-3xl shadow-2xl border border-[var(--app-border)] overflow-hidden transition-all duration-500 transform ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--app-bg)] flex">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-all duration-500 ${i <= step ? steps[step].color : 'bg-transparent'}`}
            />
          ))}
        </div>

        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[var(--app-bg)] text-[var(--app-text-muted)] transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8 pb-4 flex flex-col items-center text-center h-[400px]">
          <div className="mt-8 mb-8 p-6 bg-[var(--app-bg)] rounded-2xl shadow-inner animate-in zoom-in duration-500">
            {steps[step].icon}
          </div>

          <h2 className="text-2xl font-bold mb-3 animate-in slide-in-from-bottom-2 duration-300 key={step}">
            {steps[step].title}
          </h2>

          <p className="text-[var(--app-text-muted)] leading-relaxed max-w-sm animate-in slide-in-from-bottom-4 duration-300 key={step+'-desc'}">
            {steps[step].desc}
          </p>
        </div>

        <div className="p-6 bg-[var(--app-bg)]/50 border-t border-[var(--app-border)] flex justify-between items-center">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === step ? `w-6 ${steps[step].color.replace('bg-', 'bg-')}` : 'bg-[var(--app-border)]'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2 ${steps[step].color}`}
          >
            {step === steps.length - 1 ? (
              <>
                Get Started <Check size={18} strokeWidth={3} />
              </>
            ) : (
              <>
                Next <ChevronRight size={18} strokeWidth={3} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
