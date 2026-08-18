import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { useAppStore } from './stores/store';
import { STORAGE_KEYS } from './constants';

// Mock all external services to avoid complex dependencies
vi.mock('./services/tauriBridge', () => ({
  isTauri: () => false,
  openUrl: vi.fn(() => Promise.resolve()),
  loadApiConfig: vi.fn().mockResolvedValue(null),
  executeCliSearch: vi.fn().mockResolvedValue('[]'),
  executeCliOperation: vi.fn().mockResolvedValue(undefined),
  executeListInstalled: vi.fn().mockResolvedValue('[]'),
  executeListUpgradable: vi.fn().mockResolvedValue('[]'),
  downloadAndInstall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./services/githubService', () => ({
  searchGithubRepos: vi.fn().mockResolvedValue([]),
  validateGithubToken: vi.fn().mockResolvedValue(true),
  getCurrentUser: vi.fn().mockResolvedValue(null),
  getUserRepos: vi.fn().mockResolvedValue([]),
  getLatestRelease: vi.fn().mockResolvedValue(null),
  getInstallableAssets: vi.fn().mockReturnValue([]),
  detectReleaseType: vi.fn().mockReturnValue('none'),
}));

vi.mock('./services/aiService', () => ({
  generateAIResponse: vi.fn().mockResolvedValue('mock response'),
  chatWithAI: vi.fn().mockResolvedValue({ response: 'mock', usage: {} }),
  detectTaskComplexity: vi.fn(() => 'simple'),
  getManagerContext: vi.fn(() => ({ name: 'Test Manager', cmd: 'test' })),
  normalizeAiConfig: vi.fn((config) => config),
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
      statusType: 'info',
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
      expect(screen.getByRole('tab', { name: /switch to install/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /switch to upgrade/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /switch to uninstall/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /switch to github/i })).toBeInTheDocument();
    });
  });

  describe('Mode Switching', () => {
    it('switches to upgrade mode when upgrade button is clicked', async () => {
      render(<App />);

      const upgradeBtn = screen.getByRole('tab', { name: /switch to upgrade/i });
      fireEvent.click(upgradeBtn);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.mode).toBe('upgrade');
      });
    });

    it('switches to uninstall mode when uninstall button is clicked', async () => {
      render(<App />);

      const uninstallBtn = screen.getByRole('tab', { name: /switch to uninstall/i });
      fireEvent.click(uninstallBtn);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.mode).toBe('uninstall');
      });
    });

    it('switches to Github mode when Github button is clicked', async () => {
      render(<App />);

      const GithubBtn = screen.getByRole('tab', { name: /switch to github/i });
      fireEvent.click(GithubBtn);

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

    it('switches to Github mode on Ctrl+4', async () => {
      render(<App />);

      fireEvent.keyDown(document, { key: '4', ctrlKey: true });

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.mode).toBe('github');
      });
    });
  });

  describe('Settings tab persistence', () => {
    it('reopens the navbar settings on the last-opened tab', async () => {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS_TAB);
      render(<App />);

      // Open Settings from the navbar (generic open → lands on default tab)
      fireEvent.click(screen.getByTestId('settings-button'));
      const aiTab = await screen.findByTestId('ai-settings-tab');
      fireEvent.click(aiTab);
      expect(await screen.findByTestId('ai-settings-content')).toBeInTheDocument();

      // Close and reopen from the navbar — should land back on the AI tab
      fireEvent.click(screen.getByTestId('close-settings-button'));
      fireEvent.click(screen.getByTestId('settings-button'));
      expect(await screen.findByTestId('ai-settings-content')).toBeInTheDocument();
    });

    it('deep links open on their target tab regardless of the remembered tab', async () => {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_TAB, 'data');
      // WelcomeScreen's "Browse Essentials" routes through the ContentArea
      // openSettings('ai') deep link in web mode without an API key.
      useAppStore.setState({
        mode: 'install',
        packages: [],
        loading: false,
        error: null,
        settings: {
          ...useAppStore.getState().settings,
          activePackageManager: 'winget',
          aiConfig: { ...useAppStore.getState().settings.aiConfig, apiKey: '' },
        },
      });
      render(<App />);

      fireEvent.click(await screen.findByRole('button', { name: /browse essentials/i }));
      expect(await screen.findByTestId('ai-settings-content')).toBeInTheDocument();
    });
  });

  describe('AI settings deep-link focus', () => {
    const resetForAiTab = () => {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS_TAB);
      useAppStore.setState({
        mode: 'install',
        packages: [],
        loading: false,
        error: null,
        settings: {
          ...useAppStore.getState().settings,
          activePackageManager: 'winget',
          aiConfig: { ...useAppStore.getState().settings.aiConfig, provider: 'local-llama', apiKey: '' },
        },
      });
    };

    it('focuses the provider select when Settings opens on the AI tab via a deep link and no provider is configured', async () => {
      resetForAiTab();
      render(<App />);

      // WelcomeScreen's "Browse Essentials" deep-links to the AI settings tab in
      // web mode without an API key.
      fireEvent.click(await screen.findByRole('button', { name: /browse essentials/i }));
      const content = await screen.findByTestId('ai-settings-content');

      const providerSelect = content.querySelector('[data-testid="ai-provider-select"]') as HTMLSelectElement;
      expect(providerSelect).toBeTruthy();
      expect(document.activeElement).toBe(providerSelect);
    });

    it('focuses the Base URL field when a non-Gemini provider is configured without an endpoint', async () => {
      localStorage.removeItem(STORAGE_KEYS.SETTINGS_TAB);
      useAppStore.setState({
        mode: 'install',
        packages: [],
        loading: false,
        error: null,
        settings: {
          ...useAppStore.getState().settings,
          activePackageManager: 'winget',
          aiConfig: { provider: 'openai', apiKey: '', baseUrl: '', modelId: 'gpt-4o' },
        },
      });
      render(<App />);

      fireEvent.click(await screen.findByRole('button', { name: /browse essentials/i }));
      const content = await screen.findByTestId('ai-settings-content');

      const baseUrlInput = content.querySelector('[data-testid="ai-base-url-input"]') as HTMLInputElement;
      expect(baseUrlInput).toBeTruthy();
      expect(document.activeElement).toBe(baseUrlInput);
    });

    it('does not focus the API key field when the AI tab is opened manually from the navbar', async () => {
      resetForAiTab();
      render(<App />);

      // Generic navbar open lands on the default (Appearance) tab
      fireEvent.click(screen.getByTestId('settings-button'));
      const aiTab = await screen.findByTestId('ai-settings-tab');
      fireEvent.click(aiTab);

      const content = await screen.findByTestId('ai-settings-content');
      const keyInput = content.querySelector('input[type="password"]') as HTMLInputElement;
      expect(keyInput).toBeTruthy();
      expect(document.activeElement).not.toBe(keyInput);
    });
  });

  describe('Store Integration', () => {
    it('clears packages when switching modes', async () => {
      useAppStore.setState({
        packages: [{ id: 'test', name: 'Test', version: '1.0', source: 'winget' }],
        mode: 'install',
      });

      render(<App />);

      const upgradeBtn = screen.getByRole('tab', { name: /switch to upgrade/i });
      fireEvent.click(upgradeBtn);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.packages).toEqual([]);
      });
    });

    it('clears error when switching modes', async () => {
      useAppStore.setState({ error: 'Test error', mode: 'install' });

      render(<App />);

      const upgradeBtn = screen.getByRole('tab', { name: /switch to upgrade/i });
      fireEvent.click(upgradeBtn);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.error).toBeNull();
      });
    });
  });
});
