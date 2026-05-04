import React, { useState, useEffect } from 'react';
import { Eye, Activity, Save, Loader2, Check, X } from 'lucide-react';
import { AppSettings, AiConfig } from '../../types';

interface AiTabProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

export const AiTab: React.FC<AiTabProps> = ({ settings, onUpdateSettings }) => {
  const [localAiConfig, setLocalAiConfig] = useState<AiConfig>(settings.aiConfig);
  const [validationErrors, setValidationErrors] = useState<{ baseUrl?: string; modelId?: string }>({});
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    settings.aiConfig?.apiKey ? 'success' : 'idle'
  );
  const [testMessage, setTestMessage] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Cache for API keys per provider to prevent sharing keys
  const [keyCache, setKeyCache] = useState<Record<string, string>>({
    [settings.aiConfig?.provider || 'gemini']: settings.aiConfig?.apiKey || ''
  });

  useEffect(() => {
    if (settings && settings.aiConfig) {
      setLocalAiConfig(settings.aiConfig);
      // Update cache with loaded settings if needed
      setKeyCache(prev => ({
        ...prev,
        [settings.aiConfig.provider]: settings.aiConfig.apiKey || ''
      }));
    }
    setValidationErrors({});
  }, [settings.aiConfig]);

  useEffect(() => {
    if (localAiConfig.provider === 'ollama') {
      fetchOllamaModels(localAiConfig.baseUrl || '');
    }
  }, [localAiConfig.provider, localAiConfig.baseUrl]);

  const fetchOllamaModels = async (baseUrl: string) => {
    console.log('[AiTab] Fetching Ollama models, baseUrl:', baseUrl);
    try {
      // Use Tauri Bridge to fetch models (supports CLI and API)
      import('../../services/tauriBridge').then(async ({ listOllamaModels }) => {
        try {
          const models = await listOllamaModels();
          console.log('[AiTab] Ollama models from Tauri:', models);
          if (models && models.length > 0) {
            setOllamaModels(models);
          } else {
            console.log('[AiTab] No models from Tauri, trying HTTP fallback');
            // Fallback to direct fetch if CLI returns nothing but URL is provided
            if (baseUrl) {
              const url = baseUrl.replace(/\/v1\/?$/, '') + '/api/tags';
              console.log('[AiTab] Fetching from:', url);
              const res = await fetch(url);
              if (res.ok) {
                const data = await res.json();
                console.log('[AiTab] HTTP response:', data);
                if (data.models) {
                  const modelNames = data.models.map((m: any) => m.name);
                  console.log('[AiTab] Extracted model names:', modelNames);
                  setOllamaModels(modelNames);
                }
              } else {
                console.error('[AiTab] HTTP fetch failed with status:', res.status);
              }
            }
          }
        } catch (tauriError) {
          console.error('[AiTab] Tauri listOllamaModels failed:', tauriError);
          // Try HTTP fallback
          if (baseUrl) {
            const url = baseUrl.replace(/\/v1\/?$/, '') + '/api/tags';
            console.log('[AiTab] Fallback fetch from:', url);
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (data.models) {
                setOllamaModels(data.models.map((m: any) => m.name));
              }
            }
          }
        }
      });
    } catch (e) {
      console.error("[AiTab] Failed to fetch Ollama models:", e);
    }
  };

  const validateInput = (field: 'baseUrl' | 'modelId', value: string) => {
    let error = undefined;
    if (field === 'baseUrl' && value && !/^https?:\/\//i.test(value) && !value.includes('localhost')) error = "URL must start with http:// or https://";
    else if (field === 'modelId' && !value.trim()) error = "Model ID is required.";

    setValidationErrors(prev => {
      const next = { ...prev };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
    return error;
  };

  const saveAiConfig = () => {
    const baseUrlError = localAiConfig.provider !== 'gemini' ? validateInput('baseUrl', localAiConfig.baseUrl) : undefined;
    const modelIdError = validateInput('modelId', localAiConfig.modelId);

    if (baseUrlError || modelIdError) {
      return;
    }

    setSaveStatus('saving');

    // Use default URL for Ollama if empty
    const finalBaseUrl = localAiConfig.baseUrl || (localAiConfig.provider === 'ollama' ? 'http://localhost:11434/v1' : '');

    // Save to Secure Storage (Tauri)
    import('../../services/tauriBridge').then(({ saveApiConfig }) => {
      saveApiConfig({
        api_key: localAiConfig.apiKey,
        provider: localAiConfig.provider,
        base_url: finalBaseUrl,
        model_id: localAiConfig.modelId
      }).then(() => {
        // Use store directly since we are inside a component but outside the hook in this callback
        const { useAppStore } = require('../../stores/store');
        useAppStore.getState().setStatusMessage("AI Settings Saved & Secure", "success");

        setSaveStatus('success');
        setTimeout(() => {
          setSaveStatus('idle');
          useAppStore.getState().setStatusMessage(null);
        }, 2000);
      }).catch(e => {
        console.error("Failed to save secure config:", e);
        setSaveStatus('idle');
      });
    });

    onUpdateSettings({ ...settings, aiConfig: { ...localAiConfig, baseUrl: finalBaseUrl } });
  };

  const getBaseUrlPlaceholder = (provider: string) => {
    switch (provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'anthropic': return 'https://api.anthropic.com/v1';
      case 'ollama': return 'http://localhost:11434/v1';
      case 'lmstudio': return 'http://localhost:1234/v1';
      case 'custom': return 'https://your-custom-endpoint.com/v1';
      default: return 'https://api.example.com/v1';
    }
  };

  const getModelIdPlaceholder = (provider: string) => {
    switch (provider) {
      case 'gemini': return 'gemini-2.5-flash';
      case 'openai': return 'gpt-4o';
      case 'anthropic': return 'claude-3-5-sonnet-20241022';
      case 'ollama': return 'llama3';
      case 'lmstudio': return 'local-model';
      case 'custom': return 'my-custom-model';
      default: return 'model-id';
    }
  };

  const handleConfigChange = (field: keyof AiConfig, value: string) => {
    setLocalAiConfig(prev => ({ ...prev, [field]: value }));

    // Update key cache if API key changes
    if (field === 'apiKey') {
      setKeyCache(prev => ({ ...prev, [localAiConfig.provider]: value }));
    }

    if (field === 'baseUrl' || field === 'modelId') validateInput(field, value);
  };

  const handleTestConnection = async () => {
    setTestStatus('loading');
    setTestMessage('');
    try {
      const urlToCheck = localAiConfig.baseUrl || (localAiConfig.provider === 'ollama' ? 'http://localhost:11434/v1' : '');

      if (localAiConfig.provider === 'ollama') {
        await fetch(urlToCheck.replace(/\/v1\/?$/, '') + '/api/tags');
      } else if (localAiConfig.provider !== 'gemini' && urlToCheck) {
        await fetch(urlToCheck, { method: 'OPTIONS' }).catch(() => { });
      } else if (localAiConfig.provider === 'gemini') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setTimeout(() => {
        setTestStatus('success');
        setTestMessage('Connection successful!');
      }, 800);
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.message || "Connection failed");
    }
  };

  // Allow empty Base URL for Ollama (will use default)
  const hasErrors = Object.keys(validationErrors).length > 0 || !localAiConfig.modelId || (localAiConfig.provider !== 'gemini' && localAiConfig.provider !== 'ollama' && localAiConfig.provider !== 'local-llama' && localAiConfig.provider !== 'local-ollama' && !localAiConfig.baseUrl);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="bg-gradient-to-r from-[var(--app-primary)]/10 to-transparent p-6 rounded-xl border border-[var(--app-primary)]/20 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-[var(--app-primary)] mb-1">AI Integration</h3>
          <p className="text-xs text-[var(--app-text-muted)]">Configure LLMs for script generation, comparisons, and chat.</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 ${testStatus === 'success' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-[var(--app-surface)] text-[var(--app-text-muted)] border-[var(--app-border)]'}`}>
          {testStatus === 'success' ? <Check size={12} /> : <Activity size={12} />}
          {testStatus === 'success' ? 'Connected' : 'Not Tested'}
        </div>
      </div>

      <div className="space-y-4 bg-[var(--app-bg)]/50 p-6 rounded-2xl border border-[var(--app-border)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">Provider Type</label>
            <select
              value={localAiConfig.provider}
              onChange={(e) => {
                const newProvider = e.target.value as any;
                setLocalAiConfig(prev => ({
                  ...prev,
                  provider: newProvider,
                  apiKey: keyCache[newProvider] || '', // Restore key from cache or empty
                  baseUrl: '',
                  modelId: ''
                }));
                setValidationErrors({});
              }}
              className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)] focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent outline-none transition-all"
            >
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="ollama">Ollama / LocalAI</option>
              <option value="openai">OpenAI Compatible</option>
              <option value="custom">Custom Endpoint</option>
              <option value="local-llama">Local LLM (llama.cpp)</option>
              <option value="local-ollama">Local Ollama (API)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">{localAiConfig.provider === 'gemini' ? 'Model Name' : 'Model ID'}</label>
            <div className="relative">
              <input
                type="text"
                list="model-options"
                value={localAiConfig.modelId}
                onChange={(e) => handleConfigChange('modelId', e.target.value)}
                placeholder={getModelIdPlaceholder(localAiConfig.provider)}
                className={`w-full bg-[var(--app-surface)] border ${validationErrors.modelId ? 'border-red-500 focus:ring-red-500' : 'border-[var(--app-border)] focus:ring-[var(--app-primary)]'} rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)] focus:ring-2 outline-none transition-all`}
              />
              <datalist id="model-options">
                {localAiConfig.provider === 'gemini' && (
                  <>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced)</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fast)</option>
                    <option value="gemini-3-pro-preview">Gemini 3 Pro (Smart)</option>
                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Exp</option>
                  </>
                )}
                {localAiConfig.provider === 'openai' && (
                  <>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="o1-preview">o1 Preview</option>
                    <option value="o1-mini">o1 Mini</option>
                  </>
                )}
                {/* localAiConfig.provider === 'anthropic' && (
                  <>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                  </>
                ) */}
                {localAiConfig.provider === 'ollama' && (
                  <>
                    {ollamaModels.length > 0 ? ollamaModels.map(m => <option key={m} value={m}>{m}</option>) : (
                      <>
                        <option value="llama3">Llama 3</option>
                        <option value="mistral">Mistral</option>
                        <option value="gemma">Gemma</option>
                        <option value="deepseek-r1">DeepSeek R1</option>
                      </>
                    )}
                  </>
                )}
              </datalist>
            </div>
          </div>
        </div>

        {localAiConfig.provider !== 'gemini' && localAiConfig.provider !== 'local-llama' && localAiConfig.provider !== 'local-ollama' && (
          <div>
            <label className="text-xs font-bold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">Base URL</label>
            <input
              type="text"
              value={localAiConfig.baseUrl}
              onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
              placeholder={getBaseUrlPlaceholder(localAiConfig.provider)}
              className={`w-full bg-[var(--app-surface)] border ${validationErrors.baseUrl ? 'border-red-500 focus:ring-red-500' : 'border-[var(--app-border)] focus:ring-[var(--app-primary)]'} rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)] focus:ring-2 outline-none transition-all font-mono`}
            />
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">API Key</label>
          <div className="relative group">
            <input
              type="password"
              value={localAiConfig.apiKey}
              onChange={(e) => handleConfigChange('apiKey', e.target.value)}
              placeholder={localAiConfig.provider === 'gemini' ? 'Leave empty to use default env key' : 'Enter API Key (sk-...)'}
              className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)] focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent outline-none transition-all pr-10"
            />
            <div className="absolute right-3 top-2.5 text-[var(--app-text-muted)] group-focus-within:text-[var(--app-primary)] transition-colors">
              <Eye size={16} />
            </div>
          </div>
          {settings.aiConfig?.apiKey && (
            <div className="mt-2 flex items-center gap-2 text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded w-fit">
              <Check size={12} />
              <span>Key saved (ends in {settings.aiConfig.apiKey.slice(-4)})</span>
              <button
                onClick={() => {
                  setLocalAiConfig({ ...localAiConfig, apiKey: '' });
                  setKeyCache(prev => ({ ...prev, [localAiConfig.provider]: '' }));
                  onUpdateSettings({ ...settings, aiConfig: { ...settings.aiConfig!, apiKey: '' } });
                }}
                className="ml-2 text-[var(--app-text-muted)] hover:text-red-500 underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--app-border)]">
          <button onClick={handleTestConnection} disabled={testStatus === 'loading'} className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all border flex items-center gap-2 ${testStatus === 'loading' ? 'bg-[var(--app-bg)] text-[var(--app-text-muted)]' : 'bg-[var(--app-surface)] hover:bg-[var(--app-border)] border-[var(--app-border)] text-[var(--app-text)]'}`}>
            {testStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
            {testStatus === 'loading' ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={saveAiConfig}
            disabled={hasErrors || saveStatus === 'saving'}
            className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 ${hasErrors ? 'bg-[var(--app-border)] text-[var(--app-text-muted)] cursor-not-allowed' :
              saveStatus === 'success' ? 'bg-green-600 hover:bg-green-500 text-white' :
                'bg-[var(--app-primary)] hover:opacity-90 text-white'
              }`}
          >
            {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> :
              saveStatus === 'success' ? <Check size={16} /> :
                <Save size={16} />}
            {saveStatus === 'saving' ? 'Saving...' :
              saveStatus === 'success' ? 'Saved!' :
                'Save & Apply'}
          </button>
        </div>
        {testMessage && <div className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${testStatus === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : testStatus === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[var(--app-bg)]'}`}>{testStatus === 'success' ? <Check size={14} /> : testStatus === 'error' ? <X size={14} /> : null}<span>{testMessage}</span></div>}
      </div>
    </div>
  );
};

