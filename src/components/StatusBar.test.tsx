import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBar } from './StatusBar';
import * as tauriBridge from '../services/tauriBridge';
import * as eventApi from '@tauri-apps/api/event';

vi.mock('../services/tauriBridge', () => ({
  isTauri: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not log an error or set up a listener in web mode', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(tauriBridge.isTauri).mockReturnValue(false);

    render(<StatusBar />);

    expect(consoleError).not.toHaveBeenCalled();
    expect(eventApi.listen).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('sets up the progress listener in Tauri mode', async () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(true);

    render(<StatusBar />);

    await waitFor(() => expect(eventApi.listen).toHaveBeenCalled());
    expect(eventApi.listen).toHaveBeenCalledWith('operation-progress', expect.any(Function));
  });
});
