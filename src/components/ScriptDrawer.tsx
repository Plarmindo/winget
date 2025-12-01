import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/store';
import { X, Terminal, CheckSquare, Square, Info, ShieldAlert, Database, Trash2, Loader2, Play, RefreshCw, Download } from 'lucide-react';
import { generateScript } from '../utils/scriptUtils';
import { ScriptPreview } from './ScriptPreview';
import { isTauri } from '../services/tauriBridge';
import { executeRealCommand } from '../services/wingetService';

interface ScriptDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToUpgrade?: () => void;
  onDeepScan?: () => void;
}

export const ScriptDrawer: React.FC<ScriptDrawerProps> = ({ isOpen, onClose, onSwitchToUpgrade, onDeepScan }) => {
  const { cart, removeFromCart, clearCart, mode, settings } = useAppStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const isDesktop = isTauri();
  const packageManager = settings.activePackageManager;

  useEffect(() => { setSelectedIds(cart.map(p => p.id)); }, [cart]);
  useEffect(() => { setShowPreview(false); }, [isOpen, mode]);

  const activePackages = cart.filter(p => selectedIds.includes(p.id));
  const scriptContent = generateScript(activePackages, mode, packageManager);

  const handleExecuteNow = () => {
      if (confirm(`Launch terminal to ${mode} ${selectedIds.length} packages?`)) {
          executeRealCommand(packageManager, mode, selectedIds);
      }
  };

  const toggleSelection = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleAll = () => setSelectedIds(selectedIds.length === cart.length ? [] : cart.map(p => p.id));

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-[var(--app-surface)] border-l border-[var(--app-border)] z-50 transform transition-transform duration-300 shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--app-border)] bg-[var(--app-surface)]">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-[var(--app-primary)]/20 text-[var(--app-primary)]`}><Terminal size={20} /></div>
            <div><h2 className="text-xl font-semibold">Generate Script</h2><p className="text-xs text-[var(--app-text-muted)] capitalize">Target: {packageManager}</p></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--app-bg)] rounded-lg"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col min-h-0 bg-[var(--app-bg)]">
          {cart.length === 0 ? (
             <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50"><Terminal size={48} className="mb-4"/><p>Cart is empty.</p></div>
          ) : !showPreview ? (
             <div className="space-y-4">
                <div className="flex justify-between items-center bg-[var(--app-surface)] p-2 rounded border border-[var(--app-border)]">
                   <button onClick={toggleAll} className="text-xs flex items-center gap-2 font-bold uppercase">{selectedIds.length === cart.length ? <CheckSquare size={16}/> : <Square size={16}/>} Select All</button>
                   <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                </div>
                <div className="space-y-2">
                   {cart.map(pkg => (
                      <div key={pkg.id} className="flex items-center justify-between p-2 rounded bg-[var(--app-surface)] border border-[var(--app-border)]">
                         <div className="flex items-center gap-3 overflow-hidden">
                            <button onClick={() => toggleSelection(pkg.id)} className={selectedIds.includes(pkg.id) ? "text-[var(--app-primary)]" : "text-gray-500"}>{selectedIds.includes(pkg.id) ? <CheckSquare size={16}/> : <Square size={16}/>}</button>
                            <span className="truncate text-sm font-medium">{pkg.name}</span>
                         </div>
                         <button onClick={() => removeFromCart(pkg.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={14}/></button>
                      </div>
                   ))}
                </div>
             </div>
          ) : (
             <ScriptPreview scriptContent={scriptContent} mode={mode} packageManager={packageManager} analysis={{ total: activePackages.length, upgrades: 0, installs: activePackages.length }} excludedCount={0} onClose={() => setShowPreview(false)} />
          )}
        </div>

        {cart.length > 0 && !showPreview && (
          <div className="p-5 border-t border-[var(--app-border)] bg-[var(--app-surface)] space-y-3">
             {isDesktop && <button onClick={handleExecuteNow} disabled={selectedIds.length === 0} className="w-full py-3 bg-[var(--app-surface)] border border-[var(--app-primary)] text-[var(--app-primary)] rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-[var(--app-primary)] hover:text-white transition-all"><Play size={18}/> Execute Now</button>}
             <button onClick={() => setShowPreview(true)} disabled={selectedIds.length === 0} className="w-full py-3 bg-[var(--app-primary)] text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg"><Download size={18}/> Generate Script</button>
          </div>
        )}
      </div>
    </>
  );
};