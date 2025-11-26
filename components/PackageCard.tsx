import React from 'react';
import { WingetPackage } from '../types';
import { Plus, Check, Terminal, Info, Copy } from 'lucide-react';

interface PackageCardProps {
  pkg: WingetPackage;
  isInCart: boolean;
  onToggleCart: (pkg: WingetPackage) => void;
  onCopyCommand: (id: string) => void;
}

export const PackageCard: React.FC<PackageCardProps> = ({ pkg, isInCart, onToggleCart, onCopyCommand }) => {
  return (
    <div className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 rounded-xl p-5 transition-all duration-200 flex flex-col h-full shadow-lg hover:shadow-blue-900/10">
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
            {pkg.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 leading-tight">{pkg.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{pkg.publisher}</p>
          </div>
        </div>
        
        <div className={`px-2 py-1 rounded text-[10px] font-medium tracking-wider uppercase ${
          isInCart ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
        }`}>
          {pkg.category}
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-6 flex-grow line-clamp-2">
        {pkg.description}
      </p>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 group-hover:border-slate-600">
          <code className="text-xs text-blue-300 font-mono truncate mr-2 select-all">
            winget install {pkg.id}
          </code>
          <button 
            onClick={() => onCopyCommand(pkg.id)}
            className="text-slate-500 hover:text-white transition-colors"
            title="Copy command"
          >
            <Copy size={14} />
          </button>
        </div>

        <button
          onClick={() => onToggleCart(pkg)}
          className={`w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isInCart 
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
          }`}
        >
          {isInCart ? (
            <>
              <Check size={16} />
              <span>Added to Script</span>
            </>
          ) : (
            <>
              <Plus size={16} />
              <span>Add to Script</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};