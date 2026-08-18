import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';
import { renderHook, act, waitFor, fireEvent } from '@testing-library/react';
import * as wingetService from '../services/wingetService';
import * as githubService from '../services/githubService';
import * as tauriBridge from '../services/tauriBridge';
import { confirmDialog } from '../stores/confirmStore';
import { useAppStore } from '../stores/store';
import { DEFAULT_SETTINGS } from '../stores/slices/settingsSlice';
import { AppSettings, WingetPackage } from '../types';
import type { GitHubRepo, GitHubUser, GitHubRelease } from '../services/githubService';
import { useSearchLogic } from './useSearchLogic';
import { useGitHubData } from './useGitHubData';
import { useRateLimit } from './useRateLimit';
import { useThemeSync } from './useThemeSync';
import { useChatAudio } from './useChatAudio';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useAppController } from './useAppController';
import { usePackageOperations } from './usePackageOperations';

vi.mock('../services/wingetService', () => ({
  searchPackages: vi.fn(),
  executeRealCommand: vi.fn(),
  listUpgradablePackages: vi.fn(),
  listInstalledPackages: vi.fn(),
  parseWingetOutput: vi.fn(),
  generateAIResponse: vi.fn(),
  generateComparisonPrompt: vi.fn(),
  transcribeAudio: vi.fn(),
  generateSpeech: vi.fn(),
}));

vi.mock('../services/githubService', () => ({
  getCurrentUser: vi.fn(),
  getUserRepos: vi.fn(),
  getStarredRepos: vi.fn(),
  getLatestRelease: vi.fn(),
  getInstallableAssets: vi.fn(),
}));

vi.mock('../services/tauriBridge', () => ({
  isTauri: vi.fn(),
  loadApiConfig: vi.fn(),
  downloadAndInstall: vi.fn(),
  gitCloneRepo: vi.fn(),
}));

vi.mock('../stores/confirmStore', () => ({
  confirmDialog: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

const makePackage = (id: string, name = id): WingetPackage => ({
  id,
  name,
  version: '1.0.0',
  description: `${name} description`,
  publisher: 'Tester',
  category: 'Utilities',
  isFree: true,
  source: 'winget',
});

const makeRepo = (name: string, description = ''): GitHubRepo => ({
  id: 1,
  name,
  full_name: `octo/${name}`,
  description,
  private: false,
  html_url: `https://github.com/octo/${name}`,
  clone_url: `https://github.com/octo/${name}.git`,
  ssh_url: `git@github.com:octo/${name}.git`,
  stargazers_count: 10,
  forks_count: 2,
  open_issues_count: 1,
  language: 'TypeScript',
  default_branch: 'main',
  updated_at: '2024-01-01T00:00:00Z',
  pushed_at: '2024-01-01T00:00:00Z',
  owner: { login: 'octo', avatar_url: 'https://avatars/x.png' },
});

const makeRelease = (assets: { name: string; download_url: string; size: number }[]): GitHubRelease => ({
  id: 1,
  tag_name: 'v1.0.0',
  name: 'v1.0.0',
  html_url: 'https://github.com/octo/r/releases/v1.0.0',
  published_at: '2024-01-01T00:00:00Z',
  body: 'Release notes',
  assets,
});

const resetStore = () => {
  useAppStore.setState({
    mode: 'install',
    query: '',
    packages: [],
    loading: false,
    error: null,
    sortBy: 'name-asc',
    statusMessage: null,
    statusType: 'info',
    history: [],
    cart: [],
    favorites: [],
    compareList: [],
    chatMessages: [],
    pendingChatQuery: '',
    settings: {
      ...DEFAULT_SETTINGS,
      activePackageManager: 'winget',
      githubToken: '',
      aiConfig: { ...DEFAULT_SETTINGS.aiConfig, provider: 'gemini', apiKey: 'test', baseUrl: '', modelId: '' },
    },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  resetStore();
  vi.mocked(tauriBridge.isTauri).mockReturnValue(false);
  vi.mocked(tauriBridge.loadApiConfig).mockResolvedValue(null);
  vi.mocked(tauriBridge.downloadAndInstall).mockResolvedValue('ok');
  vi.mocked(wingetService.searchPackages).mockResolvedValue([]);
  vi.mocked(wingetService.listInstalledPackages).mockResolvedValue([]);
  vi.mocked(wingetService.listUpgradablePackages).mockResolvedValue([]);
  vi.mocked(wingetService.parseWingetOutput).mockReturnValue([]);
  vi.mocked(wingetService.generateAIResponse).mockResolvedValue('response');
  vi.mocked(wingetService.generateComparisonPrompt).mockReturnValue('prompt');
  vi.mocked(wingetService.transcribeAudio).mockResolvedValue('transcribed text');
  vi.mocked(wingetService.generateSpeech).mockResolvedValue('base64audio');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useSearchLogic', () => {
  it('searches packages in install mode and stores results', async () => {
    vi.mocked(wingetService.searchPackages).mockResolvedValue([makePackage('A.App')]);
    const { result } = renderHook(() => useSearchLogic());

    await act(async () => {
      await result.current.handleSearch('test');
    });

    expect(wingetService.searchPackages).toHaveBeenCalledWith('test', expect.anything(), expect.anything());
    expect(useAppStore.getState().packages).toHaveLength(1);
    expect(useAppStore.getState().loading).toBe(false);
    expect(useAppStore.getState().query).toBe('test');
    expect(result.current.searched).toBe(true);
    expect(result.current.hasMore).toBe(false);
  });

  it('maps POPULAR_* category keywords to real queries', async () => {
    const { result } = renderHook(() => useSearchLogic());

    await act(async () => {
      await result.current.handleSearch('POPULAR_ESSENTIALS');
    });

    expect(wingetService.searchPackages).toHaveBeenCalledWith('chrome', expect.anything(), expect.anything());
    expect(useAppStore.getState().query).toBe('');
  });

  it('ignores blank queries', async () => {
    const { result } = renderHook(() => useSearchLogic());

    await act(async () => {
      await result.current.handleSearch('   ');
    });

    expect(wingetService.searchPackages).not.toHaveBeenCalled();
  });

  it('filters local packages in upgrade mode', async () => {
    resetStore();
    useAppStore.setState({ mode: 'upgrade' });
    const alpha = makePackage('A.App', 'Alpha');
    const beta = makePackage('B.App', 'Beta');
    const { result } = renderHook(() => useSearchLogic());

    act(() => {
      result.current.storePackagesForFiltering([alpha, beta]);
    });

    await act(async () => {
      await result.current.handleSearch('alpha');
    });

    expect(useAppStore.getState().packages).toEqual([alpha]);
    expect(wingetService.searchPackages).not.toHaveBeenCalled();
  });

  it('sets an error when the search fails', async () => {
    vi.mocked(wingetService.searchPackages).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSearchLogic());

    await act(async () => {
      await result.current.handleSearch('test');
    });

    expect((useAppStore.getState().error as Error).message).toBe('boom');
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('ignores abort errors', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.mocked(wingetService.searchPackages).mockRejectedValue(abortError);
    const { result } = renderHook(() => useSearchLogic());

    await act(async () => {
      await result.current.handleSearch('test');
    });

    expect(useAppStore.getState().error).toBeNull();
  });

  it('stops an in-flight search', () => {
    const { result } = renderHook(() => useSearchLogic());
    act(() => {
      result.current.handleStopSearch();
    });
    expect(useAppStore.getState().loading).toBe(false);
  });
});

describe('useGitHubData', () => {
  it('sets an error when no token is provided', async () => {
    const { result } = renderHook(() => useGitHubData('', ''));

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.error).toBe('No GitHub token configured. Add one in Settings → Connections.');
    expect(result.current.loading).toBe(false);
    expect(githubService.getCurrentUser).not.toHaveBeenCalled();
  });

  it('loads user, repos and starred repos with a token', async () => {
    vi.mocked(githubService.getCurrentUser).mockResolvedValue({ login: 'octo' } as GitHubUser);
    vi.mocked(githubService.getUserRepos).mockResolvedValue([makeRepo('RepoA')]);
    vi.mocked(githubService.getStarredRepos).mockResolvedValue([makeRepo('Starred')]);
    const { result } = renderHook(() => useGitHubData('tok', ''));

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.user?.login).toBe('octo');
    expect(result.current.repos).toHaveLength(1);
    expect(result.current.starredRepoObjects).toHaveLength(1);
    expect(result.current.starredRepos.has('octo/Starred')).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('tolerates starred repo fetch failures', async () => {
    vi.mocked(githubService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(githubService.getUserRepos).mockResolvedValue([]);
    vi.mocked(githubService.getStarredRepos).mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() => useGitHubData('tok', ''));

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.starredRepos.size).toBe(0);
  });

  it('surfaces errors from the main data load', async () => {
    vi.mocked(githubService.getUserRepos).mockRejectedValue(new Error('bad token'));
    const { result } = renderHook(() => useGitHubData('tok', ''));

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.error).toBe('bad token');
    expect(result.current.loading).toBe(false);
  });

  it('filters repos by query and toggles stars', async () => {
    vi.mocked(githubService.getCurrentUser).mockResolvedValue(null);
    vi.mocked(githubService.getUserRepos).mockResolvedValue([makeRepo('Alpha', 'first repo'), makeRepo('Beta')]);
    vi.mocked(githubService.getStarredRepos).mockResolvedValue([makeRepo('Alpha', 'first repo')]);
    const { result } = renderHook(() => useGitHubData('tok', 'first'));

    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.repos).toHaveLength(2);
    expect(result.current.filteredRepos.map((r) => r.name)).toEqual(['Alpha']);
    expect(result.current.filteredStarred.map((r) => r.name)).toEqual(['Alpha']);

    act(() => {
      result.current.toggleStar('octo/Alpha', true);
    });
    expect(result.current.starredRepos.has('octo/Alpha')).toBe(false);

    act(() => {
      result.current.toggleStar('octo/Beta', false);
    });
    expect(result.current.starredRepos.has('octo/Beta')).toBe(true);
  });
});

describe('useRateLimit', () => {
  it('allows requests up to the token limit and then rate limits', () => {
    const { result } = renderHook(() => useRateLimit(2, 1));
    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(true);
    act(() => {
      expect(result.current.checkRateLimit()).toBe(false);
    });
    expect(result.current.isRateLimited).toBe(true);
    expect(result.current.secondsRemaining).toBeGreaterThan(0);
  });

  it('reset restores capacity', () => {
    const { result } = renderHook(() => useRateLimit(1, 1));
    expect(result.current.checkRateLimit()).toBe(true);
    expect(result.current.checkRateLimit()).toBe(false);
    act(() => {
      result.current.reset();
    });
    expect(result.current.isRateLimited).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.checkRateLimit()).toBe(true);
  });
});

describe('useThemeSync', () => {
  const themedSettings = {
    ...DEFAULT_SETTINGS,
    activeThemeId: 'custom',
    themes: [
      {
        id: 'custom',
        name: 'Custom',
        colors: {
          bg: '#000000',
          surface: '#111111',
          border: '#222222',
          text: '#ffffff',
          textMuted: '#888888',
          primary: '#0000ff',
          primaryHover: '#0000aa',
        },
      },
    ],
  } as AppSettings;

  it('applies theme colors to the document root', () => {
    renderHook(() => useThemeSync(themedSettings));
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--app-bg')).toBe('#000000');
    expect(root.style.getPropertyValue('--app-surface')).toBe('#111111');
    expect(root.style.getPropertyValue('--app-primary')).toBe('#0000ff');
  });

  it('falls back to the default theme when the active theme is missing', () => {
    renderHook(() => useThemeSync({ ...themedSettings, activeThemeId: 'missing', themes: [] }));
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--app-bg')).toBe('#0f172a');
  });
});

describe('useChatAudio', () => {
  let getUserMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getUserMediaMock = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true,
    });
  });

  const setInputMock = vi.fn();
  const geminiSettings = {
    ...DEFAULT_SETTINGS,
    aiConfig: { ...DEFAULT_SETTINGS.aiConfig, provider: 'gemini' },
  } as AppSettings;

  it('does nothing when the provider is not gemini', async () => {
    const openAiSettings = {
      ...DEFAULT_SETTINGS,
      aiConfig: { ...DEFAULT_SETTINGS.aiConfig, provider: 'openai' },
    } as AppSettings;
    const { result } = renderHook(() =>
      useChatAudio(openAiSettings, setInputMock as unknown as Dispatch<SetStateAction<string>>)
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
  });

  it('records audio, transcribes it, and appends to the input', async () => {
    const stopTrack = vi.fn();
    getUserMediaMock.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });

    const recorderInstances: MockMediaRecorder[] = [];
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor() {
        recorderInstances.push(this);
      }
      start = vi.fn(() => {
        this.state = 'recording';
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);

    class MockFileReader {
      result: string | null = null;
      onloadend: (() => void) | null = null;
      readAsDataURL = vi.fn(() => {
        queueMicrotask(() => {
          this.result = 'data:audio/webm;base64,QUJDRA==';
          this.onloadend?.();
        });
      });
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const { result } = renderHook(() =>
      useChatAudio(geminiSettings, setInputMock as unknown as Dispatch<SetStateAction<string>>)
    );

    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    const recorder = recorderInstances[0] ?? new MockMediaRecorder();
    act(() => {
      recorder.ondataavailable?.({ data: new Blob(['audio']) });
    });
    act(() => {
      result.current.stopRecording();
    });
    expect(stopTrack).toHaveBeenCalled();

    await waitFor(() => expect(wingetService.transcribeAudio).toHaveBeenCalled());
    await waitFor(() => expect(setInputMock).toHaveBeenCalledTimes(1));
    const updater = setInputMock.mock.calls[0][0] as (prev: string) => string;
    expect(updater('')).toBe('transcribed text');
    expect(updater('hi')).toBe('hi transcribed text');
    await waitFor(() => expect(result.current.isProcessingAudio).toBe(false));
  });

  it('does not update the input when transcription is empty', async () => {
    vi.mocked(wingetService.transcribeAudio).mockResolvedValue('');
    getUserMediaMock.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });

    const recorderInstances: MockMediaRecorder[] = [];
    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor() {
        recorderInstances.push(this);
      }
      start = vi.fn(() => {
        this.state = 'recording';
      });
      stop = vi.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
    }
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);

    class MockFileReader {
      result: string | null = null;
      onloadend: (() => void) | null = null;
      readAsDataURL = vi.fn(() => {
        queueMicrotask(() => {
          this.result = 'data:audio/webm;base64,QUJDRA==';
          this.onloadend?.();
        });
      });
    }
    vi.stubGlobal('FileReader', MockFileReader);

    const localSetInput = vi.fn() as unknown as Dispatch<SetStateAction<string>>;
    const { result } = renderHook(() => useChatAudio(geminiSettings, localSetInput));

    await act(async () => {
      await result.current.startRecording();
    });
    const recorder = recorderInstances[0] ?? new MockMediaRecorder();
    act(() => {
      recorder.ondataavailable?.({ data: new Blob(['audio']) });
    });
    act(() => {
      result.current.stopRecording();
    });

    await waitFor(() => expect(wingetService.transcribeAudio).toHaveBeenCalled());
    expect(localSetInput).not.toHaveBeenCalled();
  });

  it('plays TTS audio and clears the playing state when finished', async () => {
    const source = { buffer: null, connect: vi.fn(), start: vi.fn(), onended: null as (() => void) | null };
    class MockAudioContext {
      destination = {};
      createBuffer = vi.fn(() => ({ copyToChannel: vi.fn() }));
      createBufferSource = vi.fn(() => source);
    }
    vi.stubGlobal('AudioContext', MockAudioContext);
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;
    vi.mocked(wingetService.generateSpeech).mockResolvedValue(btoa('\x00\x00\x00\x00'));

    const localSetInput = vi.fn() as unknown as Dispatch<SetStateAction<string>>;
    const { result } = renderHook(() => useChatAudio(geminiSettings, localSetInput));

    await act(async () => {
      await result.current.playTTS('hello', 'msg1');
    });
    expect(result.current.playingMessageId).toBe('msg1');
    expect(wingetService.generateSpeech).toHaveBeenCalledWith('hello', expect.anything());

    act(() => {
      source.onended?.();
    });
    expect(result.current.playingMessageId).toBeNull();
  });

  it('does not start a second playback while one is playing', async () => {
    const source = { buffer: null, connect: vi.fn(), start: vi.fn(), onended: null as (() => void) | null };
    class MockAudioContext {
      destination = {};
      createBuffer = vi.fn(() => ({ copyToChannel: vi.fn() }));
      createBufferSource = vi.fn(() => source);
    }
    vi.stubGlobal('AudioContext', MockAudioContext);
    (window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext;

    const localSetInput = vi.fn() as unknown as Dispatch<SetStateAction<string>>;
    const { result } = renderHook(() => useChatAudio(geminiSettings, localSetInput));

    await act(async () => {
      await result.current.playTTS('one', 'msg1');
    });
    await act(async () => {
      await result.current.playTTS('two', 'msg2');
    });
    expect(wingetService.generateSpeech).toHaveBeenCalledTimes(1);
    expect(result.current.playingMessageId).toBe('msg1');
  });
});

describe('useKeyboardShortcuts', () => {
  it('triggers the handler for a matching shortcut', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', ctrl: true, handler, description: 'd' }]));
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores non-matching keys and inputs', () => {
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', ctrl: true, handler, description: 'd' }]));
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
    input.remove();
  });

  it('allows Escape from inputs and respects modifier requirements', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        { key: 'Escape', handler, description: 'close' },
        { key: 's', shift: true, handler, description: 'shift-s' },
      ])
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handler).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 's' });
    expect(handler).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 's', shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(2);
    input.remove();
  });

  it('does not bind shortcuts when disabled', () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useKeyboardShortcuts([{ key: 'k', ctrl: true, handler, description: 'd' }], enabled),
      { initialProps: { enabled: false } }
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
    rerender({ enabled: true });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('useAppController', () => {
  it('loads a secure API config into settings', async () => {
    vi.mocked(tauriBridge.loadApiConfig).mockResolvedValue({
      api_key: 'secret',
      provider: 'ollama',
      base_url: 'http://localhost:11434/v1',
      model_id: '',
    });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    await waitFor(() => expect(useAppStore.getState().settings.aiConfig.provider).toBe('ollama'));
    expect(useAppStore.getState().settings.aiConfig.apiKey).toBe('secret');
    expect(useAppStore.getState().settings.aiConfig.baseUrl).toBe('http://localhost:11434/v1');
    expect(useAppStore.getState().settings.aiConfig.modelId).toBe('llama3');
    expect(useAppStore.getState().statusMessage).toBe('AI Configuration Loaded & Secure');
    expect(result.current.isDesktop).toBe(false);
  });

  it('applies provider-specific default models', async () => {
    vi.mocked(tauriBridge.loadApiConfig).mockResolvedValue({
      api_key: 'k',
      provider: 'openai',
      base_url: '',
      model_id: '',
    });
    renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));
    await waitFor(() => expect(useAppStore.getState().settings.aiConfig.modelId).toBe('gpt-4o'));
  });

  it('keeps the current provider when the config has no provider', async () => {
    vi.mocked(tauriBridge.loadApiConfig).mockResolvedValue({
      api_key: 'k',
      provider: '',
      base_url: '',
      model_id: 'custom-model',
    });
    renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));
    await waitFor(() => expect(useAppStore.getState().settings.aiConfig.provider).toBe('gemini'));
    expect(useAppStore.getState().settings.aiConfig.modelId).toBe('custom-model');
  });

  it('does not show onboarding after it has been seen', async () => {
    localStorage.setItem('onboarding_seen', '1');
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.showOnboarding).toBe(false);
  });

  it('shows onboarding for first-time users', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));
    act(() => {
      vi.advanceTimersByTime(1501);
    });
    expect(result.current.showOnboarding).toBe(true);
  });

  it('refreshes upgradable packages in upgrade mode', async () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(true);
    localStorage.setItem('onboarding_seen', '1');
    const pkgs = [makePackage('A.App')];
    vi.mocked(wingetService.listUpgradablePackages).mockResolvedValue(pkgs);
    resetStore();
    useAppStore.setState({ mode: 'upgrade' });
    const storeForFiltering = vi.fn();
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), storeForFiltering));

    await act(async () => {
      await result.current.refreshPackages();
    });

    expect(wingetService.listUpgradablePackages).toHaveBeenCalled();
    expect(useAppStore.getState().packages).toEqual(pkgs);
    expect(storeForFiltering).toHaveBeenCalledWith(pkgs);
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('refreshes installed packages in uninstall mode', async () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(true);
    localStorage.setItem('onboarding_seen', '1');
    const pkgs = [makePackage('A.App')];
    vi.mocked(wingetService.listInstalledPackages).mockResolvedValue(pkgs);
    resetStore();
    useAppStore.setState({ mode: 'uninstall' });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.refreshPackages();
    });

    expect(wingetService.listInstalledPackages).toHaveBeenCalled();
    expect(useAppStore.getState().packages).toEqual(pkgs);
  });

  it('re-runs the search in install mode with a query', async () => {
    resetStore();
    useAppStore.setState({ mode: 'install', query: 'test' });
    const handleSearch = vi.fn();
    const { result } = renderHook(() => useAppController(handleSearch, vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.refreshPackages();
    });

    expect(handleSearch).toHaveBeenCalledWith('test');
    expect(wingetService.listUpgradablePackages).not.toHaveBeenCalled();
  });

  it('does nothing in github mode', async () => {
    resetStore();
    useAppStore.setState({ mode: 'github' });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.refreshPackages();
    });

    expect(wingetService.listUpgradablePackages).not.toHaveBeenCalled();
  });

  it('sets an error when the refresh fails', async () => {
    vi.mocked(tauriBridge.isTauri).mockReturnValue(true);
    localStorage.setItem('onboarding_seen', '1');
    vi.mocked(wingetService.listUpgradablePackages).mockRejectedValue(new Error('nope'));
    resetStore();
    useAppStore.setState({ mode: 'upgrade' });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.refreshPackages();
    });

    expect(useAppStore.getState().error).toBe('nope');
  });

  it('imports parsed packages and clears the input', () => {
    vi.useFakeTimers();
    const pkgs = [makePackage('A.App')];
    vi.mocked(wingetService.parseWingetOutput).mockReturnValue(pkgs);
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));
    const setImportText = vi.fn();
    const setImportError = vi.fn();

    act(() => {
      result.current.handleImport('text', setImportText, setImportError);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(wingetService.parseWingetOutput).toHaveBeenCalledWith('text');
    expect(useAppStore.getState().packages).toEqual(pkgs);
    expect(setImportText).toHaveBeenCalledWith('');
    expect(setImportError).not.toHaveBeenCalledWith('No packages found.');
  });

  it('reports when an import contains no packages', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));
    const setImportText = vi.fn();
    const setImportError = vi.fn();

    act(() => {
      result.current.handleImport('text', setImportText, setImportError);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(setImportError).toHaveBeenCalledWith('No packages found.');
    expect(useAppStore.getState().packages).toEqual([]);
  });

  it('ignores empty imports', () => {
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));
    const setImportText = vi.fn();
    const setImportError = vi.fn();

    act(() => {
      result.current.handleImport('   ', setImportText, setImportError);
    });

    expect(wingetService.parseWingetOutput).not.toHaveBeenCalled();
  });

  it('clears the cart only', () => {
    useAppStore.setState({ cart: [makePackage('A.App')] });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    act(() => {
      result.current.handleClearData('cart');
    });

    expect(useAppStore.getState().cart).toEqual([]);
  });

  it('clears chat history and reloads', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { href: 'http://localhost/', reload }, writable: true });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    act(() => {
      result.current.handleClearData('chat');
    });

    expect(localStorage.getItem('winget_chat_history')).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it('clears all data and storage', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { href: 'http://localhost/', reload }, writable: true });
    useAppStore.setState({ cart: [makePackage('A.App')] });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    act(() => {
      result.current.handleClearData('all');
    });

    expect(useAppStore.getState().cart).toEqual([]);
    expect(localStorage.getItem('winget_chat_history')).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it('runs a comparison when at least two packages are selected', async () => {
    const p1 = makePackage('A.App');
    const p2 = makePackage('B.App');
    useAppStore.setState({ compareList: [p1, p2] });
    vi.mocked(wingetService.generateAIResponse).mockResolvedValue('winner: A');
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.runComparison();
    });

    expect(wingetService.generateComparisonPrompt).toHaveBeenCalledWith([p1, p2]);
    expect(result.current.compareResult).toBe('winner: A');
    expect(result.current.isComparing).toBe(false);
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('does nothing with fewer than two packages', async () => {
    useAppStore.setState({ compareList: [makePackage('A.App')] });
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.runComparison();
    });

    expect(wingetService.generateAIResponse).not.toHaveBeenCalled();
  });

  it('reports comparison failures', async () => {
    useAppStore.setState({ compareList: [makePackage('A.App'), makePackage('B.App')] });
    vi.mocked(wingetService.generateAIResponse).mockRejectedValue(new Error('ai down'));
    const { result } = renderHook(() => useAppController(vi.fn(), vi.fn(), vi.fn()));

    await act(async () => {
      await result.current.runComparison();
    });

    expect(result.current.compareResult).toBe('Failed to generate comparison: ai down');
  });
});

describe('usePackageOperations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('executes an install, removes the package and records history', async () => {
    useAppStore.setState({ packages: [makePackage('A.App')] });
    vi.mocked(wingetService.executeRealCommand).mockResolvedValue(undefined);
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.executeOperation('A.App', 'install');
    });

    expect(wingetService.executeRealCommand).toHaveBeenCalledWith('winget', 'install', ['A.App']);
    expect(result.current.operationResult).toBe('install completed for A.App');
    expect(useAppStore.getState().packages).toEqual([]);
    expect(useAppStore.getState().history[0]).toMatchObject({
      operation: 'install',
      packageId: 'A.App',
      status: 'success',
    });
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('records failures in history and surfaces them', async () => {
    vi.mocked(wingetService.executeRealCommand).mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.executeOperation('A.App', 'install');
    });

    expect((useAppStore.getState().error as Error).message).toBe('denied');
    expect(useAppStore.getState().history[0]).toMatchObject({ status: 'error', errorMessage: 'denied' });
    expect(result.current.operationResult).toBeNull();
  });

  it('ignores user cancellations', async () => {
    vi.mocked(wingetService.executeRealCommand).mockRejectedValue({ code: 'USER_CANCELLED' });
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.executeOperation('A.App', 'install');
    });

    expect(useAppStore.getState().history).toHaveLength(0);
    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('rejects upgrades for github repositories', async () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, activePackageManager: 'github' } });
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.executeOperation('octo/repo', 'upgrade');
    });

    expect(useAppStore.getState().statusMessage).toBe(
      'Upgrade is not supported for GitHub repositories. Use git pull instead.'
    );
    expect(wingetService.executeRealCommand).not.toHaveBeenCalled();
  });

  it('rejects uninstalls for github repositories', async () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, activePackageManager: 'github' } });
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.executeOperation('octo/repo', 'uninstall');
    });

    expect(useAppStore.getState().statusMessage).toBe(
      'Uninstall is not supported for GitHub repositories. Delete the folder manually.'
    );
    expect(wingetService.executeRealCommand).not.toHaveBeenCalled();
  });

  it('opens the clone dialog for github installs', async () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, activePackageManager: 'github' } });
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.executeOperation('octo/repo', 'install');
    });

    expect(wingetService.executeRealCommand).not.toHaveBeenCalled();
    expect(result.current.CloneDialogComponent).not.toBeNull();
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('directly installs the single asset from the latest release', async () => {
    vi.mocked(githubService.getLatestRelease).mockResolvedValue(
      makeRelease([{ name: 'setup.exe', download_url: 'https://d/setup.exe', size: 1 }])
    );
    vi.mocked(githubService.getInstallableAssets).mockReturnValue(['setup.exe']);
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.handleDirectInstall('octo/repo');
    });

    expect(tauriBridge.downloadAndInstall).toHaveBeenCalledWith('https://d/setup.exe', 'setup.exe');
    expect(useAppStore.getState().history[0]).toMatchObject({ operation: 'install', status: 'success' });
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('asks before installing when multiple assets exist', async () => {
    vi.mocked(githubService.getLatestRelease).mockResolvedValue(
      makeRelease([
        { name: 'a.exe', download_url: 'https://d/a.exe', size: 1 },
        { name: 'b.exe', download_url: 'https://d/b.exe', size: 1 },
      ])
    );
    vi.mocked(githubService.getInstallableAssets).mockReturnValue(['a.exe', 'b.exe']);
    vi.mocked(confirmDialog).mockResolvedValue(true);
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.handleDirectInstall('octo/repo');
    });

    expect(confirmDialog).toHaveBeenCalled();
    expect(tauriBridge.downloadAndInstall).toHaveBeenCalledWith('https://d/a.exe', 'a.exe');
  });

  it('aborts when the user declines the multi-asset prompt', async () => {
    vi.mocked(githubService.getLatestRelease).mockResolvedValue(
      makeRelease([
        { name: 'a.exe', download_url: 'https://d/a.exe', size: 1 },
        { name: 'b.exe', download_url: 'https://d/b.exe', size: 1 },
      ])
    );
    vi.mocked(githubService.getInstallableAssets).mockReturnValue(['a.exe', 'b.exe']);
    vi.mocked(confirmDialog).mockResolvedValue(false);
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.handleDirectInstall('octo/repo');
    });

    expect(tauriBridge.downloadAndInstall).not.toHaveBeenCalled();
    expect(useAppStore.getState().loading).toBe(false);
  });

  it('reports missing releases and missing assets', async () => {
    vi.mocked(githubService.getLatestRelease).mockResolvedValue(null);
    const { result } = renderHook(() => usePackageOperations());

    await act(async () => {
      await result.current.handleDirectInstall('octo/repo');
    });

    expect((useAppStore.getState().error as Error).message).toBe('No releases found for this repository.');

    vi.mocked(githubService.getLatestRelease).mockResolvedValue(
      makeRelease([{ name: 'docs.pdf', download_url: 'u', size: 1 }])
    );
    vi.mocked(githubService.getInstallableAssets).mockReturnValue([]);
    await act(async () => {
      await result.current.handleDirectInstall('octo/repo');
    });
    expect((useAppStore.getState().error as Error).message).toContain('No installable binaries');
  });
});
