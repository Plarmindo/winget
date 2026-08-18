import React from 'react';
import { X, CheckCircle, XCircle, Loader2, Download, RefreshCw, Trash2, GitBranch, AlertCircle } from 'lucide-react';

export interface BatchOperation {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
}

interface BatchProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  operations: BatchOperation[];
  currentIndex?: number; // Optional, not currently used
  onCancel: () => void;
  operationType: 'install' | 'upgrade' | 'uninstall';
  canRetry: boolean;
  onRetry?: () => void;
}

export const BatchProgressModal: React.FC<BatchProgressModalProps> = ({
  isOpen,
  onClose,
  operations,
  onCancel,
  operationType,
  canRetry,
  onRetry,
}) => {
  if (!isOpen) return null;

  const completed = operations.filter((op) => op.status === 'success' || op.status === 'error').length;
  const failed = operations.filter((op) => op.status === 'error').length;
  const isComplete = completed === operations.length;
  const progress = operations.length > 0 ? (completed / operations.length) * 100 : 0;

  const getOperationIcon = (type: typeof operationType) => {
    switch (type) {
      case 'install':
        return <Download size={20} className="text-green-500" />;
      case 'upgrade':
        return <RefreshCw size={20} className="text-blue-500" />;
      case 'uninstall':
        return <Trash2 size={20} className="text-red-500" />;
      default:
        return <GitBranch size={20} />;
    }
  };

  const getStatusIcon = (status: BatchOperation['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'error':
        return <XCircle size={18} className="text-red-500" />;
      case 'processing':
        return <Loader2 size={18} className="text-blue-500 animate-spin" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-[var(--app-border)]"></div>;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[var(--app-surface)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-[var(--app-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--app-border)]">
          <div className="flex items-center gap-3">
            {getOperationIcon(operationType)}
            <div>
              <h2 className="text-xl font-semibold text-[var(--app-text)] capitalize">{operationType} Progress</h2>
              <p className="text-sm text-[var(--app-text-muted)]">
                {completed} of {operations.length} packages {isComplete ? 'completed' : 'processed'}
              </p>
            </div>
          </div>
          <button
            onClick={isComplete ? onClose : undefined}
            disabled={!isComplete}
            className={`p-2 rounded-lg transition-colors ${
              isComplete
                ? 'hover:bg-[var(--app-border)] text-[var(--app-text-muted)]'
                : 'opacity-50 cursor-not-allowed text-[var(--app-text-muted)]'
            }`}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="relative h-2 bg-[var(--app-border)] rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--app-primary)] transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-[var(--app-text-muted)]">
            <span>{Math.round(progress)}% complete</span>
            {failed > 0 && <span className="text-red-500">{failed} failed</span>}
          </div>
        </div>

        {/* Operations List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {operations.map((op) => (
              <div
                key={op.id}
                className={`p-4 rounded-lg border transition-all ${
                  op.status === 'success'
                    ? 'bg-green-500/5 border-green-500/20'
                    : op.status === 'error'
                      ? 'bg-red-500/5 border-red-500/20'
                      : op.status === 'processing'
                        ? 'bg-blue-500/5 border-blue-500/30 ring-2 ring-blue-500/20'
                        : 'bg-[var(--app-bg)] border-[var(--app-border)]'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getStatusIcon(op.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--app-text)] truncate">{op.name}</span>
                        {op.status === 'processing' && (
                          <span className="text-xs text-blue-500 font-medium">Processing...</span>
                        )}
                      </div>
                      {op.errorMessage && (
                        <p className="text-sm text-red-400 mt-1 flex items-start gap-1">
                          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                          <span>{op.errorMessage}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-[var(--app-border)]">
          {isComplete ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                {failed === 0 ? (
                  <>
                    <CheckCircle size={18} className="text-green-500" />
                    <span className="text-green-500 font-medium">All operations completed successfully!</span>
                  </>
                ) : (
                  <>
                    <XCircle size={18} className="text-red-500" />
                    <span className="text-red-500 font-medium">
                      Completed with {failed} error{failed !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {canRetry && failed > 0 && onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-4 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Retry Failed
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-[var(--app-primary)] text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm text-[var(--app-text-muted)]">Operation in progress...</span>
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors"
              >
                Cancel Remaining
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
