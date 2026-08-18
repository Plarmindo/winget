import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentArea } from './ContentArea';
import { useAppStore } from '../stores/store';
import * as tauriBridge from '../services/tauriBridge';
import { AppMode, WingetPackage } from '../types';

vi.mock('../services/tauriBridge', () => ({
  isTauri: vi.fn(),
  openUrl: vi.fn(() => Promise.resolve()),
  loadApiConfig: vi.fn().mockResolvedValue(null),
  executeCliSearch: vi.fn().mockResolvedValue('[]'),
  executeCliOperation: vi.fn().mockResolvedValue(undefined),
  executeListInstalled: vi.fn().mockResolvedValue('[]'),
  executeListUpgradable: vi.fn().mockResolvedValue('[]'),
  downloadAndInstall: vi.fn().mockResolvedValue(undefined),
}));

const baseProps = {
  packages: [] as WingetPackage[],
  mode: 'install' as AppMode,
  loading: false,
  searched: true,
  query: '',
  error: null as string | Error | null,
  isDesktop: false,
  importText: '',
  setImportText: vi.fn(),
  importError: null as string | null,
  handleSearch: vi.fn(),
  handleImport: vi.fn(),
  handleDirectExecution: vi.fn(),
  handleFetchAiDetails: vi.fn(),
  handleDirectInstall: vi.fn(),
  handleGitHubAction: vi.fn(),
  executeOperation: vi.fn(),
  openSettings: vi.fn(),
  setError: vi.fn(),
  setPackages: vi.fn(),
  setSearched: vi.fn(),
  setQuery: vi.fn(),
};

describe('ContentArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        activePackageManager: 'winget',
        aiConfig: { ...useAppStore.getState().settings.aiConfig, apiKey: '' },
      },
    });
  });

  it('shows a set-your-API-key empty state in web mode with no API key', () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(false);

    render(<ContentArea {...baseProps} />);

    expect(screen.getByText('Set your API key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
  });

  it('opens settings when the Open Settings button is clicked', () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(false);

    render(<ContentArea {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(baseProps.openSettings).toHaveBeenCalled();
  });

  it('shows plain no-results in desktop mode even without an API key', () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(true);

    render(<ContentArea {...baseProps} />);

    expect(screen.getByText('No packages found.')).toBeInTheDocument();
    expect(screen.queryByText('Set your API key')).not.toBeInTheDocument();
  });

  it('shows plain no-results when an API key is configured', () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        activePackageManager: 'winget',
        aiConfig: { ...useAppStore.getState().settings.aiConfig, apiKey: 'some-key' },
      },
    });

    render(<ContentArea {...baseProps} />);

    expect(screen.getByText('No packages found.')).toBeInTheDocument();
    expect(screen.queryByText('Set your API key')).not.toBeInTheDocument();
  });

  describe('AI search error state', () => {
    const renderWithError = (error: string | Error) => {
      render(<ContentArea {...baseProps} error={error} />);
    };

    it('shows an Open AI Settings action for web-mode AI search failures', () => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
      renderWithError('Failed to fetch results via AI. Check your API Key and Settings.');

      expect(screen.getByRole('button', { name: 'Open AI Settings' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('opens settings when Open AI Settings is clicked', () => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
      renderWithError('Failed to fetch results via AI. Check your API Key and Settings.');

      fireEvent.click(screen.getByRole('button', { name: 'Open AI Settings' }));

      expect(baseProps.openSettings).toHaveBeenCalled();
    });

    it('does not show Open AI Settings for an Error object with a matching message', () => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
      renderWithError(new Error('Failed to fetch results via AI. Check your API Key and Settings.'));

      expect(screen.getByRole('button', { name: 'Open AI Settings' })).toBeInTheDocument();
    });

    it('does not show Open AI Settings for non-AI errors', () => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
      renderWithError('CLI Search failed: something else');

      expect(screen.queryByRole('button', { name: 'Open AI Settings' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('does not show Open AI Settings in desktop mode', () => {
      vi.mocked(tauriBridge.isTauri).mockReturnValue(true);
      renderWithError('Failed to fetch results via AI. Check your API Key and Settings.');

      expect(screen.queryByRole('button', { name: 'Open AI Settings' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });
  });
});
