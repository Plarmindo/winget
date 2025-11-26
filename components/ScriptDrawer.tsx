import React, { useState } from 'react';
import { WingetPackage } from '../types';
import { X, Copy, Trash2, Download, Terminal, CheckCircle2 } from 'lucide-react';

interface ScriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: WingetPackage[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const ScriptDrawer: React.FC<ScriptDrawerProps> = ({ isOpen, onClose, cart, onRemove, onClear }) => {
  const [copied, setCopied] = useState(false);

  const generateScript = () => {
    if (cart.length === 0) return '';
    const commands = cart.map(pkg => `winget install --id ${pkg.id} -e --source winget`);
    return commands.join('\n');
  };

  const scriptContent = generateScript();

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-slate-900 border-l border-slate-700 z-50 transform transition-transform duration-300 shadow-2xl flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600/20 p-2 rounded-lg text-blue-400">
              <Terminal size={20} />
            </div>
            <h2 className="text-xl font-semibold text-white">Install Script</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {cart.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
              <Terminal size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Your script is empty</p>
              <p className="text-sm mt-2 max-w-[200px]">Add packages from the search results to generate a bulk install script.</p>
            </div>
          ) : (
            <>
              {/* Selected List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  <span>Selected Packages ({cart.length})</span>
                  <button onClick={onClear} className="text-red-400 hover:text-red-300">Clear All</button>
                </div>
                {cart.map(pkg => (
                  <div key={pkg.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 group hover:border-slate-600">
                    <div className="flex items-center space-x-3 truncate">
                      <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        {pkg.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-slate-200 truncate">{pkg.name}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{pkg.id}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onRemove(pkg.id)}
                      className="p-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Script Preview */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Generated Powershell Script
                </label>
                <div className="relative">
                  <pre className="bg-black/50 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre border border-slate-800/50 shadow-inner min-h-[150px]">
                    {scriptContent}
                  </pre>
                  <div className="absolute top-2 right-2 flex space-x-1">
                     <button
                        onClick={handleCopy}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded shadow-lg border border-slate-600 transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                     </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-2 mt-2">
                  <Info className="w-3 h-3" />
                  Run this in PowerShell or Command Prompt.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-slate-800 bg-slate-900">
             <button
              onClick={handleCopy}
              className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all ${
                copied 
                  ? 'bg-green-600 text-white' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {copied ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copy Script</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

function Info(props: React.SVGProps<SVGSVGElement>) {
  return (
      <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
