import React, { useState, useEffect } from 'react';
import { X, Folder, GitBranch, HardDrive, Clock } from 'lucide-react';
import { isTauri, getDocumentDir } from '../services/tauriBridge';

interface CloneDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (destination: string) => void;
    repoName: string;
    repoUrl: string;
}

export const CloneDialog: React.FC<CloneDialogProps> = ({ isOpen, onClose, onConfirm, repoName, repoUrl }) => {
    const [destination, setDestination] = useState('');
    const [rememberLocation, setRememberLocation] = useState(false);

    useEffect(() => {
        const initPath = async () => {
            if (isOpen) {
                // Try to load last used location
                const lastLocation = localStorage.getItem('lastCloneLocation');
                if (lastLocation) {
                    setDestination(`${lastLocation}\\${repoName}`);
                    return;
                }

                // Generate default using Tauri API if available
                if (isTauri()) {
                    const docDir = await getDocumentDir();
                    if (docDir) {
                        // Ensure no trailing slash on docDir before joining
                        const sanitizedDocDir = docDir.replace(/[\\/]+$/, '');
                        setDestination(`${sanitizedDocDir}\\GitHub\\${repoName}`);
                        return;
                    }
                }

                // Fallback for web or if API fails
                setDestination(`C:\\Users\\user\\Documents\\GitHub\\${repoName}`);
            }
        };

        initPath();
    }, [isOpen, repoName]);

    const handleBrowse = async () => {
        if (!isTauri()) {
            alert('File picker is only available in desktop mode');
            return;
        }

        try {
            // Dynamic import of Tauri dialog
            // @ts-ignore
            const { open } = await window.__TAURI__.dialog;
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: destination,
            });

            if (selected && typeof selected === 'string') {
                setDestination(selected);
            }
        } catch (e) {
            console.error('Failed to open file picker:', e);
        }
    };

    const handleConfirm = () => {
        if (!destination.trim()) return;

        if (rememberLocation) {
            // Save the parent directory for future use
            const lastSlash = destination.lastIndexOf('\\');
            if (lastSlash !== -1) {
                const parentDir = destination.substring(0, lastSlash);
                localStorage.setItem('lastCloneLocation', parentDir);
            }
        }

        onConfirm(destination);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
                className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-2xl w-full max-w-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-[var(--app-border)] flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--app-primary)]/10 rounded-lg">
                            <GitBranch className="text-[var(--app-primary)]" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--app-text)]">Clone Repository</h2>
                            <p className="text-sm text-[var(--app-text-muted)] mt-1">{repoName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--app-bg)] rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Repository URL (read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--app-text)] mb-2">
                            Repository URL
                        </label>
                        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg text-sm text-[var(--app-text-muted)] font-mono">
                            <GitBranch size={16} />
                            <span className="truncate">{repoUrl}</span>
                        </div>
                    </div>

                    {/* Destination Path */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--app-text)] mb-2">
                            Destination Directory
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={destination}
                                onChange={(e) => setDestination(e.target.value)}
                                placeholder="C:\Users\username\Documents\GitHub\repo-name"
                                className="flex-1 px-4 py-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg text-sm text-[var(--app-text)] font-mono focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent outline-none"
                            />
                            {isTauri() && (
                                <button
                                    onClick={handleBrowse}
                                    className="px-4 py-2 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg hover:bg-[var(--app-surface)] hover:border-[var(--app-primary)] transition-colors flex items-center gap-2 text-[var(--app-text)]"
                                    title="Browse..."
                                >
                                    <Folder size={16} />
                                    <span className="hidden sm:inline">Browse</span>
                                </button>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-[var(--app-text-muted)] flex items-center gap-1">
                            <HardDrive size={12} />
                            The repository will be cloned to this location
                        </p>
                    </div>

                    {/* Remember Location Checkbox */}
                    <div className="flex items-center gap-2 p-3 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg">
                        <input
                            type="checkbox"
                            id="remember-location"
                            checked={rememberLocation}
                            onChange={(e) => setRememberLocation(e.target.checked)}
                            className="w-4 h-4 text-[var(--app-primary)] bg-[var(--app-surface)] border-[var(--app-border)] rounded focus:ring-2 focus:ring-[var(--app-primary)]"
                        />
                        <label htmlFor="remember-location" className="text-sm text-[var(--app-text)] cursor-pointer flex items-center gap-2">
                            <Clock size={14} />
                            Remember this location for future clones
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[var(--app-border)] flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-bg)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!destination.trim()}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${destination.trim()
                            ? 'bg-[var(--app-primary)] text-white hover:opacity-90 shadow-lg'
                            : 'bg-[var(--app-border)] text-[var(--app-text-muted)] cursor-not-allowed'
                            }`}
                    >
                        Clone Repository
                    </button>
                </div>
            </div>
        </div>
    );
};
