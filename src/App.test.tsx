import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { useAppStore } from './stores/store';

// Mock all external services to avoid complex dependencies
vi.mock('./services/tauriBridge', () => ({
    isTauri: () => false,
    openUrl: vi.fn(() => Promise.resolve()),
    loadApiConfig: vi.fn().mockResolvedValue(null),
    executeCliSearch: vi.fn().mockResolvedValue('[]'),
    executeCliOperation: vi.fn().mockResolvedValue(undefined),
    executeListInstalled: vi.fn().mockResolvedValue('[]'),
    executeListUpgradable: vi.fn().mockResolvedValue('[]'),
    downloadAndInstall: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('./services/githubService', () => ({
    searchGitHubRepos: vi.fn().mockResolvedValue([]),
    validateGitHubToken: vi.fn().mockResolvedValue(true),
    getCurrentUser: vi.fn().mockResolvedValue(null),
    getUserRepos: vi.fn().mockResolvedValue([]),
    getLatestRelease: vi.fn().mockResolvedValue(null),
    getInstallableAssets: vi.fn().mockReturnValue([]),
    detectReleaseType: vi.fn().mockReturnValue('none')
}));

vi.mock('./services/aiService', () => ({
    generateAIResponse: vi.fn().mockResolvedValue('mock response'),
    chatWithAI: vi.fn().mockResolvedValue({ response: 'mock', usage: {} }),
    detectTaskComplexity: vi.fn(() => 'simple'),
    getManagerContext: vi.fn(() => ({ name: 'Test Manager', cmd: 'test' })),
    normalizeAiConfig: vi.fn((config) => config)
}));

describe('App Component', () => {
    beforeEach(() => {
        // Reset store state before each test
        useAppStore.setState({
            mode: 'install',
            query: '',
            packages: [],
            loading: false,
            error: null,
            compareList: [],
            pendingChatQuery: '',
            statusMessage: null,
            statusType: 'info'
        });
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the application without crashing', () => {
            render(<App />);
            // App should render successfully
            expect(document.body).toBeTruthy();
        });

        it('renders mode navigation buttons', () => {
            render(<App />);
            expect(screen.getByText('Install')).toBeInTheDocument();
            expect(screen.getByText('Upgrade')).toBeInTheDocument();
            expect(screen.getByText('Uninstall')).toBeInTheDocument();
            expect(screen.getByText('GitHub')).toBeInTheDocument();
        });
    });

    describe('Mode Switching', () => {
        it('switches to upgrade mode when upgrade button is clicked', async () => {
            render(<App />);

            const upgradeBtn = screen.getByText('Upgrade');
            fireEvent.click(upgradeBtn);

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.mode).toBe('upgrade');
            });
        });

        it('switches to uninstall mode when uninstall button is clicked', async () => {
            render(<App />);

            const uninstallBtn = screen.getByText('Uninstall');
            fireEvent.click(uninstallBtn);

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.mode).toBe('uninstall');
            });
        });

        it('switches to github mode when github button is clicked', async () => {
            render(<App />);

            const githubBtn = screen.getByText('GitHub');
            fireEvent.click(githubBtn);

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.mode).toBe('github');
            });
        });
    });

    describe('Keyboard Shortcuts', () => {
        it('switches to install mode on Ctrl+1', async () => {
            useAppStore.setState({ mode: 'upgrade' });
            render(<App />);

            fireEvent.keyDown(document, { key: '1', ctrlKey: true });

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.mode).toBe('install');
            });
        });

        it('switches to upgrade mode on Ctrl+2', async () => {
            render(<App />);

            fireEvent.keyDown(document, { key: '2', ctrlKey: true });

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.mode).toBe('upgrade');
            });
        });

        it('switches to uninstall mode on Ctrl+3', async () => {
            render(<App />);

            fireEvent.keyDown(document, { key: '3', ctrlKey: true });

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.mode).toBe('uninstall');
            });
        });

        it('switches to github mode on Ctrl+4', async () => {
            render(<App />);

            fireEvent.keyDown(document, { key: '4', ctrlKey: true });

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.mode).toBe('github');
            });
        });
    });

    describe('Store Integration', () => {
        it('clears packages when switching modes', async () => {
            useAppStore.setState({
                packages: [{ id: 'test', name: 'Test', version: '1.0', source: 'winget' }],
                mode: 'install'
            });

            render(<App />);

            const upgradeBtn = screen.getByText('Upgrade');
            fireEvent.click(upgradeBtn);

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.packages).toEqual([]);
            });
        });

        it('clears error when switching modes', async () => {
            useAppStore.setState({ error: 'Test error', mode: 'install' });

            render(<App />);

            const upgradeBtn = screen.getByText('Upgrade');
            fireEvent.click(upgradeBtn);

            await waitFor(() => {
                const state = useAppStore.getState();
                expect(state.error).toBeNull();
            });
        });
    });
});
