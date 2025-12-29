import { useState, useCallback } from 'react';
import { AppMode } from '../types';
import { executeRealCommand } from '../services/wingetService';
import { useAppStore } from '../stores/store';
import { CloneDialog } from '../components/CloneDialog';
import { getLatestRelease, getInstallableAssets } from '../services/githubService';
import { downloadAndInstall } from '../services/tauriBridge';
import { logger } from '../utils/logger';

export const usePackageOperations = () => {
    const setLoading = useAppStore(s => s.setLoading);
    const setError = useAppStore(s => s.setError);
    const settings = useAppStore(s => s.settings);
    const setStatusMessage = useAppStore(s => s.setStatusMessage);
    const addHistoryEntry = useAppStore(s => s.addHistoryEntry);
    const packages = useAppStore(s => s.packages);
    const setPackages = useAppStore(s => s.setPackages);
    const [operationResult, setOperationResult] = useState<string | null>(null);
    const [showCloneDialog, setShowCloneDialog] = useState(false);
    const [pendingClone, setPendingClone] = useState<{ id: string; url: string } | null>(null);

    const executeOperation = useCallback(async (id: string, mode: AppMode) => {
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
                // Handle case where id is already a full URL
                let cloneUrl = id;
                if (!id.startsWith('http') && !id.startsWith('git@')) {
                    cloneUrl = `https://github.com/${id}.git`;
                }

                // Sanitize: Remove trailing slashes which can cause "repository not found"
                cloneUrl = cloneUrl.replace(/\/+$/, '');

                // Ensure it ends with .git if it's a github https url and doesn't have it
                if (cloneUrl.startsWith('https://github.com') && !cloneUrl.endsWith('.git')) {
                    cloneUrl += '.git';
                }

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

            // Remove the package from the UI grid after successful operation
            setPackages(packages.filter(pkg => pkg.id !== id));

            // Clear status after 3 seconds
            setTimeout(() => setStatusMessage('', 'success'), 3000);
        } catch (error: any) {
            // Ignore user cancellation
            if (error.code === 'USER_CANCELLED') {
                logger.debug('Operation cancelled by user');
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
    }, [setLoading, setError, setStatusMessage, settings.activePackageManager, addHistoryEntry, packages, setPackages]);

    const handleDirectInstall = useCallback(async (id: string) => {
        const [owner, repo] = id.split('/');
        setLoading(true);
        setStatusMessage(`Checking releases for ${id}...`, 'info');

        try {
            const release = await getLatestRelease(owner, repo, settings.githubToken);
            if (!release) throw new Error('No releases found for this repository.');

            const assets = getInstallableAssets(release);
            if (assets.length === 0) throw new Error('No installable binaries (.exe, .msi, etc.) found in the latest release.');

            // For now, if multiple assets, we pick the first one or prompt?
            // User requested: "Implement asset selection if multiple binaries are available"
            // Let's implement a simple selection if > 1
            let selectedAsset = assets[0];
            if (assets.length > 1) {
                const choice = confirm(`Multiple installable assets found:\n${assets.join('\n')}\n\nInstall the first one (${assets[0]})?`);
                if (!choice) {
                    setLoading(false);
                    return;
                }
            }

            const assetDetails = release.assets.find(a => a.name === selectedAsset);
            if (!assetDetails) throw new Error('Selected asset not found.');

            setStatusMessage(`Downloading ${selectedAsset}...`, 'info');
            await downloadAndInstall(assetDetails.download_url, selectedAsset);

            setStatusMessage(`Successfully launched installer for ${selectedAsset}!`, 'success');

            // Track in history
            addHistoryEntry({
                operation: 'install',
                packageId: id,
                packageName: id,
                manager: 'github',
                status: 'success',
            });

            setTimeout(() => setStatusMessage('', 'success'), 5000);
        } catch (error: any) {
            addHistoryEntry({
                operation: 'install',
                packageId: id,
                packageName: id,
                manager: 'github',
                status: 'error',
                errorMessage: error.message || String(error),
            });

            setError(error);
            setStatusMessage(`Failed to install ${id}: ${error.message || error}`, 'error');
            setTimeout(() => setStatusMessage('', 'error'), 5000);
        } finally {
            setLoading(false);
        }
    }, [setLoading, setStatusMessage, settings.githubToken, setError, addHistoryEntry]);

    const handleCloneConfirm = useCallback(async (destination: string) => {
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
    }, [pendingClone, setLoading, setStatusMessage, addHistoryEntry, setError]);

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

    return { executeOperation, operationResult, CloneDialogComponent, handleDirectInstall };
};
