import { useState } from 'react';
import { AppMode } from '../types';
import { executeRealCommand } from '../services/wingetService';
import { useAppStore } from '../stores/store';
import { CloneDialog } from '../components/CloneDialog';

export const usePackageOperations = () => {
    const { setLoading, setError, settings, setStatusMessage, addHistoryEntry } = useAppStore();
    const [operationResult, setOperationResult] = useState<string | null>(null);
    const [showCloneDialog, setShowCloneDialog] = useState(false);
    const [pendingClone, setPendingClone] = useState<{ id: string; url: string } | null>(null);

    const executeOperation = async (id: string, mode: AppMode) => {
        setLoading(true);
        setOperationResult(null);
        setError(null);
        setStatusMessage(`${mode}ing ${id}...`, 'info');

        // Special handling for GitHub repositories
        if (settings.activePackageManager === 'github') {
            if (mode === 'upgrade') {
                setStatusMessage('Upgrade is not supported for GitHub repositories. Use git pull instead.', 'error');
                setLoading(false);
                setTimeout(() => setStatusMessage('', 'error'), 3000);
                return;
            }

            if (mode === 'uninstall') {
                setStatusMessage('Uninstall is not supported for GitHub repositories. Delete the folder manually.', 'error');
                setLoading(false);
                setTimeout(() => setStatusMessage('', 'error'), 3000);
                return;
            }

            if (mode === 'install') {
                // Show clone dialog instead of prompt
                const cloneUrl = `https://github.com/${id}.git`;
                setPendingClone({ id, url: cloneUrl });
                setShowCloneDialog(true);
                setLoading(false);
                return;
            }
        }

        try {
            await executeRealCommand(settings.activePackageManager, mode, [id]);
            setOperationResult(`${mode} completed for ${id}`);
            setStatusMessage(`Successfully ${mode}ed ${id}!`, 'success');

            // Track in history
            addHistoryEntry({
                operation: mode as 'install' | 'upgrade' | 'uninstall',
                packageId: id,
                packageName: id,
                manager: settings.activePackageManager,
                status: 'success',
            });

            // Clear status after 3 seconds
            setTimeout(() => setStatusMessage('', 'success'), 3000);
        } catch (error: any) {
            // Ignore user cancellation
            if (error.code === 'USER_CANCELLED') {
                console.log("Operation cancelled by user.");
                return;
            }

            // Track error in history
            addHistoryEntry({
                operation: mode as 'install' | 'upgrade' | 'uninstall',
                packageId: id,
                packageName: id,
                manager: settings.activePackageManager,
                status: 'error',
                errorMessage: error.message || String(error),
            });

            setError(error);
            setStatusMessage(`Failed to ${mode} ${id}`, 'error');
            setTimeout(() => setStatusMessage('', 'error'), 5000);
        } finally {
            setLoading(false);
        }
    };

    const handleCloneConfirm = async (destination: string) => {
        if (!pendingClone) return;

        setLoading(true);
        setStatusMessage(`Cloning ${pendingClone.id} to ${destination}...`, 'info');

        try {
            const { gitCloneRepo } = await import('../services/tauriBridge');
            await gitCloneRepo(pendingClone.url, destination);

            setOperationResult(`Successfully cloned ${pendingClone.id}`);
            setStatusMessage(`Successfully cloned ${pendingClone.id} to ${destination}!`, 'success');

            // Track in history
            addHistoryEntry({
                operation: 'clone',
                packageId: pendingClone.id,
                packageName: pendingClone.id,
                manager: 'github',
                status: 'success',
            });

            setTimeout(() => setStatusMessage('', 'success'), 5000);
        } catch (error: any) {
            // Track error in history
            addHistoryEntry({
                operation: 'clone',
                packageId: pendingClone.id,
                packageName: pendingClone.id,
                manager: 'github',
                status: 'error',
                errorMessage: error.message || String(error),
            });

            setError(error);
            setStatusMessage(`Failed to clone ${pendingClone.id}: ${error.message || error}`, 'error');
            setTimeout(() => setStatusMessage('', 'error'), 5000);
        } finally {
            setLoading(false);
            setPendingClone(null);
        }
    };

    const CloneDialogComponent = pendingClone ? (
        <CloneDialog
            isOpen={showCloneDialog}
            onClose={() => {
                setShowCloneDialog(false);
                setPendingClone(null);
            }}
            onConfirm={handleCloneConfirm}
            repoName={pendingClone.id.split('/')[1] || pendingClone.id}
            repoUrl={pendingClone.url}
        />
    ) : null;

    return { executeOperation, operationResult, CloneDialogComponent };
};
