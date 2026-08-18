import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from './WelcomeScreen';
import { useAppStore } from '../stores/store';
import * as tauriBridge from '../services/tauriBridge';

vi.mock('../services/tauriBridge', () => ({
  isTauri: vi.fn(),
}));

describe('WelcomeScreen', () => {
  const handleSearch = vi.fn();
  const openSettings = vi.fn();

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

  it('opens AI settings in web mode without an API key instead of searching', () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(false);

    render(<WelcomeScreen handleSearch={handleSearch} openSettings={openSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /browse essentials/i }));

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(handleSearch).not.toHaveBeenCalled();
  });

  it('searches when an API key is configured in web mode', () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
    useAppStore.setState({
      settings: {
        ...useAppStore.getState().settings,
        activePackageManager: 'winget',
        aiConfig: { ...useAppStore.getState().settings.aiConfig, apiKey: 'some-key' },
      },
    });

    render(<WelcomeScreen handleSearch={handleSearch} openSettings={openSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /browse essentials/i }));

    expect(handleSearch).toHaveBeenCalledWith('POPULAR_ESSENTIALS');
    expect(openSettings).not.toHaveBeenCalled();
  });

  it('searches in desktop mode regardless of API key', () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(true);

    render(<WelcomeScreen handleSearch={handleSearch} openSettings={openSettings} />);

    fireEvent.click(screen.getByRole('button', { name: /browse essentials/i }));

    expect(handleSearch).toHaveBeenCalledWith('POPULAR_ESSENTIALS');
    expect(openSettings).not.toHaveBeenCalled();
  });
});
