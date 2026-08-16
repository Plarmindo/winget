import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import { ProgressEvent } from '../types';

export const StatusBar: React.FC = () => {
  const [currentEvent, setCurrentEvent] = useState<ProgressEvent | null>(null);
  const [logs, setLogs] = useState<ProgressEvent[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen('operation-progress', (event: { payload: ProgressEvent }) => {
          const payload = event.payload;
          setCurrentEvent(payload);
          setLogs((prev) => [...prev, payload]);
          setIsVisible(true);

          // Auto-scroll if open
          if (isOpen) {
            setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        });
        return unlisten;
      } catch (e) {
        console.error('Failed to setup status bar listener', e);
      }
    };

    setupListener().then((fn) => (unlistenFn = fn));

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [isOpen]);

  // Auto-scroll when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isOpen]);

  if (!isVisible && logs.length === 0) return null;

  return (
    <>
      {/* Logs Drawer */}
      {isOpen && (
        <div className="fixed bottom-8 left-0 right-0 h-64 bg-[#0d1117] border-t border-[var(--app-border)] z-40 p-4 overflow-y-auto font-mono text-xs shadow-inner animate-in slide-in-from-bottom-2 text-gray-300">
          <div className="flex justify-between items-center mb-2 sticky top-0 bg-[#0d1117] pb-2 border-b border-gray-800">
            <span className="font-bold text-gray-400">Operation Logs</span>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          </div>
          {logs.map((log, i) => (
            <div
              key={i}
              className="flex gap-2 py-0.5 border-b border-gray-800/50 last:border-0 hover:bg-white/5 px-1 rounded"
            >
              <span
                className={`w-20 shrink-0 font-bold ${log.operation === 'install' ? 'text-green-400' : log.operation === 'uninstall' ? 'text-red-400' : 'text-blue-400'}`}
              >
                [{log.operation}]
              </span>
              <span className="break-all">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Main Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--app-surface)] border-t border-[var(--app-border)] h-8 flex items-center px-4 justify-between z-50 text-xs shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-3 overflow-hidden flex-1 mr-4">
          {currentEvent ? (
            <>
              <Loader2 size={12} className="animate-spin text-[var(--app-primary)] shrink-0" />
              <span className="font-semibold text-[var(--app-text)] shrink-0">
                {currentEvent.operation.toUpperCase()}: {currentEvent.package}
              </span>
              <span className="text-[var(--app-text-muted)] truncate hidden md:inline-block opacity-70">
                {' '}
                - {currentEvent.message}
              </span>
            </>
          ) : logs.length > 0 ? (
            <span className="text-[var(--app-text-muted)]">
              Idle. Last operation: {logs[logs.length - 1].operation}
            </span>
          ) : (
            <span className="text-[var(--app-text-muted)]">Ready</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[var(--app-bg)] transition-colors ${isOpen ? 'text-[var(--app-primary)] bg-[var(--app-primary)]/10' : 'text-[var(--app-text-muted)]'}`}
            title="Toggle Logs"
          >
            <Terminal size={12} />
            <span className="hidden sm:inline">Logs</span>
            {isOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          <button
            onClick={() => {
              setIsVisible(false);
              setIsOpen(false);
            }}
            className="p-1 hover:bg-[var(--app-bg)] rounded text-[var(--app-text-muted)] hover:text-red-500"
            title="Close Status Bar"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </>
  );
};
