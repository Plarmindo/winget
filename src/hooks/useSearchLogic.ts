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
        query
    } = useAppStore();

    const [searched, setSearched] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStopSearch = () => {
        abortControllerRef.current?.abort();
        setLoading(false);
    };

    const handleSearch = async (searchQuery: string) => {
        if (!searchQuery.trim() && searchQuery !== "POPULAR_ESSENTIALS") return;

        abortControllerRef.current?.abort();
        const ac = new AbortController();
        abortControllerRef.current = ac;

        setLoading(true);
        setSearched(true);
        setError(null);
        setHasMore(true);
        setPackages([]);
        setQuery(searchQuery === "POPULAR_ESSENTIALS" ? "" : searchQuery);

        try {
            const results = await searchPackages(searchQuery, [], settings, ac.signal);
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

    return {
        handleSearch,
        handleStopSearch,
        searched,
        setSearched,
        hasMore,
        setHasMore
    };
};
