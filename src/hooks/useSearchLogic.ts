import { useState, useRef, useEffect } from 'react';
import { searchPackages } from '../services/wingetService';
import { useAppStore } from '../stores/store';

export const useSearchLogic = () => {
    const {
        settings,
        setPackages,
        setLoading,
        setError,
        setQuery,
        mode
    } = useAppStore();

    const [searched, setSearched] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [allPackages, setAllPackages] = useState<any[]>([]); // Store all loaded packages for filtering
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStopSearch = () => {
        abortControllerRef.current?.abort();
        setLoading(false);
    };

    const handleSearch = async (searchQuery: string) => {
        if (!searchQuery.trim() && searchQuery !== "POPULAR_ESSENTIALS") return;



        // For upgrade/uninstall modes, just filter the already-loaded packages
        if (mode === 'upgrade' || mode === 'uninstall') {
            const filtered = allPackages.filter(pkg =>
                pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pkg.id.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setPackages(filtered);
            setQuery(searchQuery);
            setSearched(true);
            return;
        }

        // For install mode, do the actual search
        abortControllerRef.current?.abort();
        const ac = new AbortController();
        abortControllerRef.current = ac;

        setLoading(true);
        setSearched(true);
        setError(null);
        setHasMore(true);
        setPackages([]);

        // Map category keywords to actual search queries for winget
        let actualQuery = searchQuery;
        const categoryMap: Record<string, string> = {
            "POPULAR_ESSENTIALS": "chrome",  // Search for Chrome as a popular app
            "POPULAR_GAMING": "steam",
            "POPULAR_PRODUCTIVITY": "office",
            "POPULAR_UTILITIES": "notepad",
            "POPULAR_MULTIMEDIA": "vlc",
            "POPULAR_SYSTEM": "powertoys"
        };

        if (categoryMap[searchQuery]) {
            actualQuery = categoryMap[searchQuery];
        }

        setQuery(searchQuery.startsWith("POPULAR_") ? "" : searchQuery);

        try {
            const results = await searchPackages(actualQuery, [], settings, ac.signal);
            setPackages(results);
            if (results.length < 12) setHasMore(false);
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                setError(error);
            }
        } finally {
            if (!ac.signal.aborted) {
                setLoading(false);
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    // Store packages when they're loaded for upgrade/uninstall filtering
    const storePackagesForFiltering = (pkgs: any[]) => {
        setAllPackages(pkgs);
    };

    return {
        handleSearch,
        handleStopSearch,
        searched,
        setSearched,
        hasMore,
        setHasMore,
        storePackagesForFiltering
    };
};
