import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AiTab } from './AiTab';
import { AppSettings } from '../../types';

// AiTab dynamically imports the Tauri bridge for secure key storage and local
// model management — stub it so tests run in pure jsdom.
vi.mock('../../services/tauriBridge', () => ({
  loadApiConfig: vi.fn().mockResolvedValue(null),
  saveApiConfig: vi.fn().mockResolvedValue(undefined),
  listOllamaModels: vi.fn().mockResolvedValue([]),
  isLocalModelLoaded: vi.fn().mockResolvedValue(false),
  getLocalModelInfo: vi.fn().mockResolvedValue(null),
  selectModelFile: vi.fn().mockResolvedValue(null),
  initializeLocalModel: vi.fn().mockResolvedValue(false),
  unloadLlamaModel: vi.fn().mockResolvedValue(undefined),
}));

const makeSettings = (aiOverrides?: Partial<AppSettings['aiConfig']>): AppSettings => ({
  reducedMotion: false,
  highContrast: false,
  compactMode: false,
  defaultModel: 'smart',
  activeThemeId: 'default',
  themes: [],
  customSubjects: [],
  itemsPerPage: 6,
  activePackageManager: 'winget',
  aiConfig: {
    provider: 'local-llama',
    apiKey: '',
    baseUrl: '',
    modelId: 'llama3.gguf',
    localModelPath: './models/llama3.gguf',
    ...aiOverrides,
  },
});

describe('AiTab deep-link focus', () => {
  it('focuses the provider select when no provider is configured', () => {
    const { container } = render(<AiTab settings={makeSettings()} onUpdateSettings={vi.fn()} focusOnMount />);

    const providerSelect = container.querySelector('[data-testid="ai-provider-select"]') as HTMLSelectElement;
    expect(document.activeElement).toBe(providerSelect);
  });

  it('focuses the Base URL input when a non-Gemini provider lacks an endpoint', () => {
    const { container } = render(
      <AiTab
        settings={makeSettings({ provider: 'openai', modelId: 'gpt-4o' })}
        onUpdateSettings={vi.fn()}
        focusOnMount
      />
    );

    const baseUrlInput = container.querySelector('[data-testid="ai-base-url-input"]') as HTMLInputElement;
    expect(baseUrlInput).toBeTruthy();
    expect(document.activeElement).toBe(baseUrlInput);
  });

  it('focuses the model selector when a provider has an endpoint but the API key is missing', () => {
    const { container } = render(
      <AiTab
        settings={makeSettings({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4o' })}
        onUpdateSettings={vi.fn()}
        focusOnMount
      />
    );

    const keyInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const modelInput = container.querySelector('input[list="model-options"]') as HTMLInputElement;
    expect(document.activeElement).toBe(modelInput);
    expect(document.activeElement).not.toBe(keyInput);
  });

  it('focuses the model selector for Gemini when the API key is missing (no Base URL needed)', () => {
    const { container } = render(
      <AiTab
        settings={makeSettings({ provider: 'gemini', modelId: 'gemini-2.5-flash' })}
        onUpdateSettings={vi.fn()}
        focusOnMount
      />
    );

    const modelInput = container.querySelector('input[list="model-options"]') as HTMLInputElement;
    expect(document.activeElement).toBe(modelInput);
  });

  it('focuses the API key input when the provider is fully configured', () => {
    const { container } = render(
      <AiTab
        settings={makeSettings({
          provider: 'openai',
          apiKey: 'sk-test',
          baseUrl: 'https://api.openai.com/v1',
          modelId: 'gpt-4o',
        })}
        onUpdateSettings={vi.fn()}
        focusOnMount
      />
    );

    const keyInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(document.activeElement).toBe(keyInput);
  });

  it('does not focus any field on a manual Intelligence tab visit', () => {
    const { container } = render(<AiTab settings={makeSettings()} onUpdateSettings={vi.fn()} />);

    const keyInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    const providerSelect = container.querySelector('[data-testid="ai-provider-select"]') as HTMLSelectElement;
    expect(document.activeElement).not.toBe(keyInput);
    expect(document.activeElement).not.toBe(providerSelect);
  });
});
