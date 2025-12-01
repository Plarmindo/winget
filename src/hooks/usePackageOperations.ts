import { useState } from 'react';
import { AppMode } from '../types';
import { executeRealCommand } from '../services/wingetService';
import { useAppStore } from '../stores/store';

export const usePackageOperations = () => {
    const { setLoading, setError, settings } = useAppStore();
    const [operationResult, setOperationResult] = useState<string | null>(null);

    const executeOperation = async (id: string, mode: AppMode) => {
        setLoading(true);
        setOperationResult(null);
        setError(null);

        try {
            await executeRealCommand(settings.activePackageManager, mode, [id]);
            setOperationResult(`${mode} completed for ${id}`);
        } catch (error: any) {
            setError(error);
        } finally {
            setLoading(false);
        }
    };

    return { executeOperation, operationResult };
};
