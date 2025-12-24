import { StateCreator } from 'zustand';
import { WingetPackage, AppMode } from '../../types';

export interface HistoryEntry {
    id: string;
    timestamp: number;
    operation: 'install' | 'upgrade' | 'uninstall' | 'clone';
    packageId: string;
    packageName: string;
    manager: string;
    status: 'success' | 'error';
    errorMessage?: string;
}

export type SortByType = 'name-asc' | 'name-desc' | 'manager';

export interface UiSlice {
    // Mode & Query
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    query: string;
    setQuery: (query: string) => void;

    // Package list
    packages: WingetPackage[];
    setPackages: (packages: WingetPackage[]) => void;

    // Loading & Error
    loading: boolean;
    setLoading: (loading: boolean) => void;
    error: any | null;
    setError: (error: any | null) => void;

    // Sort/Filter
    sortBy: SortByType;
    setSortBy: (sortBy: SortByType) => void;

    // Status Bar
    statusMessage: string | null;
    statusType: 'info' | 'success' | 'error';
    setStatusMessage: (message: string | null, type?: 'info' | 'success' | 'error') => void;

    // History
    history: HistoryEntry[];
    addHistoryEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
    clearHistory: () => void;
    getRecentHistory: (limit?: number) => HistoryEntry[];
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set, get) => ({
    // Mode & Query
    mode: 'install',
    setMode: (mode) => set({ mode, packages: [], query: '', error: null }),
    query: '',
    setQuery: (query) => set({ query }),

    // Package list
    packages: [],
    setPackages: (packages) => set({ packages }),

    // Loading & Error
    loading: false,
    setLoading: (loading) => set({ loading }),
    error: null,
    setError: (error) => set({ error }),

    // Sort/Filter
    sortBy: 'name-asc',
    setSortBy: (sortBy) => set({ sortBy }),

    // Status Bar
    statusMessage: null,
    statusType: 'info',
    setStatusMessage: (message, type = 'info') => set({ statusMessage: message, statusType: type }),

    // History
    history: [],
    addHistoryEntry: (entry) => {
        const newEntry: HistoryEntry = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
        };
        set((state) => ({
            history: [newEntry, ...state.history].slice(0, 100),
        }));
    },
    clearHistory: () => set({ history: [] }),
    getRecentHistory: (limit = 10) => get().history.slice(0, limit),
});
