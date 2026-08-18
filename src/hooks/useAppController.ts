import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../stores/store';
import { isTauri, loadApiConfig } from '../services/tauriBridge';
import {
  generateAIResponse,
  generateComparisonPrompt,
  listUpgradablePackages,
  listInstalledPackages,
  parseWingetOutput,
} from '../services/wingetService';
import { logger } from '../utils/logger';
import { STORAGE_KEYS } from '../constants';
import { WingetPackage, AiProviderType } from '../types';

export const useAppController = (
  handleSearch: (query: string) => void,
  _handleStopSearch: () => void,
  storePackagesForFiltering: (pkgs: WingetPackage[]) => void
) => {
  const updateSettings = useAppStore((s) => s.updateSettings);
  const mode = useAppStore((s) => s.mode);
  const query = useAppStore((s) => s.query);
  const setPackages = useAppStore((s) => s.setPackages);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);
  const clearCart = useAppStore((s) => s.clearCart);
  const compareList = useAppStore((s) => s.compareList);
  const setStatusMessage = useAppStore((s) => s.setStatusMessage);

  const [isDesktop, setIsDesktop] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<string | null>(null);

  // Initialize App
  useEffect(() => {
    setIsDesktop(isTauri());

    const loadConfig = async () => {
      try {
        const config = await loadApiConfig();
        if (config) {
          const currentSettings = useAppStore.getState().settings;
          const newProvider =
            config.provider && config.provider.trim() !== '' ? config.provider : currentSettings.aiConfig.provider;

          // Provider-specific model defaults (only used if no model_id is saved)
          const getDefaultModel = (provider: string) => {
            switch (provider) {
              case 'ollama':
                return 'llama3';
              case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
              case 'openai':
                return 'gpt-4o';
              default:
                return 'gemini-2.5-flash';
            }
          };

          updateSettings({
            aiConfig: {
              provider: newProvider as AiProviderType,
              apiKey: config.api_key,
              baseUrl: config.base_url || (newProvider === 'ollama' ? 'http://localhost:11434/v1' : ''),
              modelId: config.model_id || getDefaultModel(newProvider),
            },
          });
          setStatusMessage('AI Configuration Loaded & Secure', 'success');
          setTimeout(() => setStatusMessage(null), 4000);
        }
      } catch (e) {
        logger.error('Failed to load secure config', e);
      }
    };
    loadConfig();

    const hasSeenOnboarding = localStorage.getItem('onboarding_seen');
    if (!hasSeenOnboarding) {
      setTimeout(() => setShowOnboarding(true), 1500);
    }
  }, [updateSettings, setStatusMessage]);

  // Progress Listener
  useEffect(() => {
    if (!isTauri()) return;

    let unlistenFn: (() => void) | undefined;

    const setup = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlistenFn = await listen<{ operation: string; percent: number; message: string }>(
        'operation-progress',
        (event) => {
          if (event.payload.percent === 100) {
            setLoading(false);
          }
        }
      );
    };
    setup();

    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [setLoading]);

  // Refresh Packages Logic
  const refreshPackages = useCallback(async () => {
    if (mode === 'install' && query) {
      handleSearch(query);
      return;
    }
    if (mode === 'github' || !isDesktop) return;

    setLoading(true);
    try {
      if (mode === 'upgrade') {
        const upgradablePackages = await listUpgradablePackages();
        setPackages(upgradablePackages);
        storePackagesForFiltering(upgradablePackages);
      } else if (mode === 'uninstall') {
        const installedPackages = await listInstalledPackages();
        setPackages(installedPackages);
        storePackagesForFiltering(installedPackages);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [mode, query, handleSearch, setLoading, setPackages, storePackagesForFiltering, setError, isDesktop]);

  // Data Handlers
  const handleClearData = useCallback(
    (type: 'cart' | 'chat' | 'all') => {
      if (type === 'cart' || type === 'all') clearCart();
      if (type === 'chat' || type === 'all') {
        localStorage.removeItem(STORAGE_KEYS.CHAT);
        window.location.reload();
      }
      if (type === 'all') {
        useAppStore.persist.clearStorage();
        window.location.reload();
      }
    },
    [clearCart]
  );

  const handleImport = useCallback(
    (importText: string, setImportText: (s: string) => void, setImportError: (s: string | null) => void) => {
      if (!importText.trim()) return;
      setImportError(null);
      setError(null);
      setTimeout(() => {
        try {
          const parsed = parseWingetOutput(importText);
          if (parsed.length === 0) {
            setImportError('No packages found.');
            setPackages([]);
          } else {
            setPackages(parsed);
            setImportText('');
          }
        } catch {
          setImportError('Parsing error.');
        }
      }, 500);
    },
    [setError, setPackages]
  );

  const runComparison = useCallback(async () => {
    if (compareList.length < 2) return;
    setIsComparing(true);
    setCompareResult(null);

    try {
      setLoading(true);
      const prompt = generateComparisonPrompt(compareList);
      const result = await generateAIResponse(
        useAppStore.getState().settings,
        prompt,
        'You are a software comparison expert...'
      );
      setCompareResult(result);
    } catch (e: unknown) {
      setCompareResult(`Failed to generate comparison: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsComparing(false);
      setLoading(false);
    }
  }, [compareList, setLoading]);

  return {
    isDesktop,
    showOnboarding,
    setShowOnboarding,
    isComparing,
    compareResult,
    refreshPackages,
    handleClearData,
    handleImport,
    runComparison,
  };
};
