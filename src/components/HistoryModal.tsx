import React from 'react';
import { X, Clock, CheckCircle, XCircle, Download, RefreshCw, Trash2, GitBranch } from 'lucide-react';
import { useAppStore, HistoryEntry } from '../stores/store';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
    const { history, clearHistory } = useAppStore();

    if (!isOpen) return null;

    const getOperationIcon = (operation: HistoryEntry['operation']) => {
        switch (operation) {
            case 'install':
                return <Download size={16} className="text-green-500" />;
            case 'upgrade':
                return <RefreshCw size={16} className="text-blue-500" />;
            case 'uninstall':
                return <Trash2 size={16} className="text-red-500" />;
            case 'clone':
                return <GitBranch size={16} className="text-purple-500" />;
            default:
                return <Clock size={16} />;
        }
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const handleClearHistory = () => {
        if (window.confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
            clearHistory();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-[var(--app-surface)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-[var(--app-border)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--app-border)]">
                    <div className="flex items-center gap-3">
                        <Clock size={24} className="text-[var(--app-primary)]" />
                        <h2 className="text-xl font-semibold text-[var(--app-text)]">Installation History</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {history.length > 0 && (
                            <button
                                onClick={handleClearHistory}
                                className="px-3 py-1.5 text-sm rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                            >
                                Clear History
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-[var(--app-border)] transition-colors text-[var(--app-text-muted)]"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {history.length === 0 ? (
                        <div className="text-center py-12 text-[var(--app-text-muted)]">
                            <Clock size={48} className="mx-auto mb-4 opacity-30" />
                            <p>No installation history yet</p>
                            <p className="text-sm mt-2">Your package operations will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`p-4 rounded-lg border transition-colors ${entry.status === 'success'
                                            ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10'
                                            : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="mt-0.5">{getOperationIcon(entry.operation)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-[var(--app-text)] capitalize">
                                                        {entry.operation}
                                                    </span>
                                                    <span className="text-[var(--app-text-muted)]">·</span>
                                                    <span className="text-[var(--app-text)] truncate">{entry.packageName}</span>
                                                    <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--app-border)] text-[var(--app-text-muted)]">
                                                        {entry.manager}
                                                    </span>
                                                </div>
                                                {entry.errorMessage && (
                                                    <p className="text-sm text-red-400 mt-1">{entry.errorMessage}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <span className="text-xs text-[var(--app-text-muted)] whitespace-nowrap">
                                                {formatTimestamp(entry.timestamp)}
                                            </span>
                                            {entry.status === 'success' ? (
                                                <CheckCircle size={18} className="text-green-500" />
                                            ) : (
                                                <XCircle size={18} className="text-red-500" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
