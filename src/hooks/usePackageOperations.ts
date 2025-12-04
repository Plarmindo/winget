import { useState } from 'react';
import { AppMode } from '../types';
import { executeRealCommand } from '../services/wingetService';
import { useAppStore } from '../stores/store';

export const usePackageOperations = () => {
    const { setLoading, setError, settings, setStatusMessage } = useAppStore();
    const [operationResult, setOperationResult] = useState<string | null>(null);

    const executeOperation = async (id: string, mode: AppMode) => {
        setLoading(true);
        setOperationResult(null);
        setError(null);
        setStatusMessage(`${mode}ing ${id}...`, 'info');

        if (mode === 'upgrade' && settings.activePackageManager === 'github') {
            setStatusMessage('Upgrade is not supported for GitHub repositories.', 'error');
            setLoading(false);
            setTimeout(() => setStatusMessage('', 'error'), 3000);
            return;
        }

        try {
            await executeRealCommand(settings.activePackageManager, mode, [id]);
            setOperationResult(`${mode} completed for ${id}`);
            setStatusMessage(`Successfully ${mode}ed ${id}!`, 'success');

            // Clear status after 3 seconds
            setTimeout(() => setStatusMessage('', 'success'), 3000);
        } catch (error: any) {
            // Ignore user cancellation
            if (error.code === 'USER_CANCELLED') {
                console.log("Operation cancelled by user.");
                return;
            }

            setError(error);
            setStatusMessage(`Failed to ${mode} ${id}`, 'error');
            setTimeout(() => setStatusMessage('', 'error'), 5000);
        } finally {
            setLoading(false);
        }
    };

    return { executeOperation, operationResult };
};
