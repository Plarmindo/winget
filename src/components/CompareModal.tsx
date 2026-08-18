import React from 'react';
import { X, Sparkles, Loader2, CheckCircle2, XCircle, Scale } from 'lucide-react';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: string | null;
  isLoading: boolean;
}

interface ComparisonData {
  apps: string[];
  features: { name: string; values: string[] }[];
  pros: { app: string; items: string[] }[];
  cons: { app: string; items: string[] }[];
  verdict: string;
}

export const CompareModal: React.FC<CompareModalProps> = ({ isOpen, onClose, result, isLoading }) => {
  if (!isOpen) return null;

  let parsedData: ComparisonData | null = null;

  if (result) {
    try {
      parsedData = JSON.parse(result);
    } catch (e) {
      // Fallback to text if JSON parsing fails
      parsedData = null;
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden text-[var(--app-text)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[var(--app-border)] flex items-center justify-between bg-[var(--app-surface)]">
          <div className="flex items-center gap-2">
            <Scale size={24} className="text-[var(--app-primary)]" />
            <h2 className="text-xl font-bold">Package Comparison</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--app-bg)] rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[var(--app-bg)]/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--app-text-muted)] space-y-4">
              <Loader2 size={48} className="animate-spin text-[var(--app-primary)]" />
              <div className="text-center">
                <p className="text-lg font-medium text-[var(--app-text)]">Analyzing Packages...</p>
                <p className="text-sm">Comparing features, pros, cons, and gathering data.</p>
              </div>
            </div>
          ) : result ? (
            parsedData ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Feature Table */}
                <div className="border border-[var(--app-border)] rounded-xl overflow-hidden shadow-lg">
                  <div
                    className="grid bg-[var(--app-surface)] border-b border-[var(--app-border)]"
                    style={{ gridTemplateColumns: `150px repeat(${parsedData.apps.length}, 1fr)` }}
                  >
                    <div className="p-4 font-bold text-[var(--app-text-muted)] flex items-center">Feature</div>
                    {parsedData.apps.map((app, i) => (
                      <div
                        key={i}
                        className="p-4 font-bold text-[var(--app-text)] text-center border-l border-[var(--app-border)] bg-[var(--app-primary)]/10"
                      >
                        {app}
                      </div>
                    ))}
                  </div>
                  {parsedData.features.map((feature, idx) => (
                    <div
                      key={idx}
                      className={`grid hover:bg-[var(--app-surface)]/50 transition-colors ${idx !== parsedData.features.length - 1 ? 'border-b border-[var(--app-border)]' : ''}`}
                      style={{ gridTemplateColumns: `150px repeat(${parsedData.apps.length}, 1fr)` }}
                    >
                      <div className="p-3 text-sm font-medium text-[var(--app-text-muted)] bg-[var(--app-bg)]/30">
                        {feature.name}
                      </div>
                      {feature.values.map((val, vIdx) => (
                        <div
                          key={vIdx}
                          className="p-3 text-sm text-center border-l border-[var(--app-border)] flex items-center justify-center"
                        >
                          {val}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Pros & Cons Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pros */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 size={20} /> Pros
                    </h3>
                    <div className="grid gap-4">
                      {parsedData.pros.map((p, i) => (
                        <div
                          key={i}
                          className="bg-[var(--app-surface)] rounded-xl p-4 border border-emerald-900/30 shadow-sm relative overflow-hidden group"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                          <h4 className="font-bold text-sm mb-2">{p.app}</h4>
                          <ul className="space-y-1">
                            {p.items.map((item, idx) => (
                              <li key={idx} className="text-xs text-[var(--app-text-muted)] flex items-start gap-2">
                                <span className="text-emerald-500 mt-0.5">•</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cons */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-red-400">
                      <XCircle size={20} /> Cons
                    </h3>
                    <div className="grid gap-4">
                      {parsedData.cons.map((c, i) => (
                        <div
                          key={i}
                          className="bg-[var(--app-surface)] rounded-xl p-4 border border-red-900/30 shadow-sm relative overflow-hidden group"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                          <h4 className="font-bold text-sm mb-2">{c.app}</h4>
                          <ul className="space-y-1">
                            {c.items.map((item, idx) => (
                              <li key={idx} className="text-xs text-[var(--app-text-muted)] flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span> {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Verdict */}
                <div className="bg-[var(--app-primary)]/10 border border-[var(--app-primary)]/30 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles size={64} />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--app-primary)] mb-2 flex items-center gap-2">
                    <Sparkles size={20} /> AI Verdict
                  </h3>
                  <p className="text-sm leading-relaxed">{parsedData.verdict}</p>
                </div>
              </div>
            ) : (
              // Fallback for non-JSON response
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap leading-relaxed">{result}</div>
              </div>
            )
          ) : (
            <div className="text-center text-[var(--app-text-muted)]">No comparison data available.</div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-surface)] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[var(--app-primary)] text-white rounded-lg font-bold hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
