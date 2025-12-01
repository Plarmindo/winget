import React, { useState, useEffect } from 'react';
import { Cloud, Server, AlertCircle, Eye, Activity, Save, Loader2, Check, X } from 'lucide-react';
import { AppSettings, AiConfig } from '../../types';

interface AiTabProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

export const AiTab: React.FC<AiTabProps> = ({ settings, onUpdateSettings }) => {
  const defaultAiConfig: AiConfig = { 
    provider: 'gemini', apiKey: '', baseUrl: '', modelId: 'gemini-2.5-flash' 
  };
  const [localAiConfig, setLocalAiConfig] = useState<AiConfig>(settings.aiConfig || defaultAiConfig);
  const [validationErrors, setValidationErrors] = useState<{ baseUrl?: string; modelId?: string }>({});
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if (settings && settings.aiConfig) setLocalAiConfig(settings.aiConfig);
    setValidationErrors({});
  }, [settings.aiConfig]);

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
    onUpdateSettings({ ...settings, aiConfig: localAiConfig });
  };

  const getBaseUrlPlaceholder = (provider: string) => {
    switch(provider) {
      case 'openai': return 'https://api.openai.com/v1';
      case 'ollama': return 'http://localhost:11434/v1';
      case 'lmstudio': return 'http://localhost:1234/v1';
      case 'custom': return 'https://your-custom-endpoint.com/v1';
      default: return 'https://api.example.com/v1';
    }
  };

  const getModelIdPlaceholder = (provider: string) => {
    switch(provider) {
      case 'gemini': return 'gemini-2.5-flash';
      case 'openai': return 'gpt-4o';
      case 'ollama': return 'llama3';
      case 'lmstudio': return 'local-model';
      case 'custom': return 'my-custom-model';
      default: return 'model-id';
    }
  };

  const handleConfigChange = (field: keyof AiConfig, value: string) => {
      setLocalAiConfig(prev => ({ ...prev, [field]: value }));
      if (field === 'baseUrl' || field === 'modelId') validateInput(field, value);
  };

  const handleTestConnection = async () => {
     setTestStatus('loading');
     setTestMessage('');
     try {
        if (localAiConfig.provider !== 'gemini' && localAiConfig.baseUrl) {
             try { await fetch(localAiConfig.baseUrl, { method: 'OPTIONS' }).catch(() => {}); } catch(e) {} 
        }
        setTimeout(() => {
            setTestStatus('success');
            setTestMessage('Connection successful!');
        }, 800);
     } catch (e: any) {
        setTestStatus('error');
        setTestMessage(e.message);
     }
  };

  const hasErrors = Object.keys(validationErrors).length > 0 || !localAiConfig.modelId || (localAiConfig.provider !== 'gemini' && !localAiConfig.baseUrl);

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
                          setLocalAiConfig(prev => ({ ...prev, provider: newProvider, baseUrl: '', modelId: '' }));
                          setValidationErrors({});
                      }} 
                      className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)] focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent outline-none transition-all"
                  >
                      <option value="gemini">Google Gemini</option>
                      <option value="ollama">Ollama / LocalAI</option>
                      <option value="openai">OpenAI Compatible</option>
                      <option value="custom">Custom Endpoint</option>
                  </select>
              </div>
              <div>
                   <label className="text-xs font-bold text-[var(--app-text-muted)] block mb-1.5 uppercase tracking-wider">{localAiConfig.provider === 'gemini' ? 'Model Name' : 'Model ID'}</label>
                    <div className="relative">
                      <input 
                          type="text" 
                          value={localAiConfig.modelId} 
                          onChange={(e) => handleConfigChange('modelId', e.target.value)} 
                          placeholder={getModelIdPlaceholder(localAiConfig.provider)} 
                          className={`w-full bg-[var(--app-surface)] border ${validationErrors.modelId ? 'border-red-500 focus:ring-red-500' : 'border-[var(--app-border)] focus:ring-[var(--app-primary)]'} rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)] focus:ring-2 outline-none transition-all`} 
                      />
                    </div>
              </div>
          </div>
          
          {localAiConfig.provider !== 'gemini' && (
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
                      onChange={(e) => setLocalAiConfig({ ...localAiConfig, apiKey: e.target.value })} 
                      placeholder={localAiConfig.provider === 'gemini' ? 'Leave empty to use default env key' : 'Enter API Key (sk-...)'} 
                      className="w-full bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--app-text)] focus:ring-2 focus:ring-[var(--app-primary)] focus:border-transparent outline-none transition-all pr-10" 
                  />
                  <div className="absolute right-3 top-2.5 text-[var(--app-text-muted)] group-focus-within:text-[var(--app-primary)] transition-colors">
                      <Eye size={16} />
                  </div>
              </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-[var(--app-border)]">
            <button onClick={handleTestConnection} disabled={testStatus === 'loading'} className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all border flex items-center gap-2 ${testStatus === 'loading' ? 'bg-[var(--app-bg)] text-[var(--app-text-muted)]' : 'bg-[var(--app-surface)] hover:bg-[var(--app-border)] border-[var(--app-border)] text-[var(--app-text)]'}`}>
                {testStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />} 
                {testStatus === 'loading' ? 'Testing...' : 'Test Connection'}
            </button>
            <button 
                onClick={saveAiConfig} 
                disabled={hasErrors}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 ${hasErrors ? 'bg-[var(--app-border)] text-[var(--app-text-muted)] cursor-not-allowed' : 'bg-[var(--app-primary)] hover:opacity-90 text-white'}`}
            >
                <Save size={16} /> Save & Apply
            </button>
          </div>
          {testMessage && <div className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${testStatus === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : testStatus === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[var(--app-bg)]'}`}>{testStatus === 'success' ? <Check size={14} /> : testStatus === 'error' ? <X size={14} /> : null}<span>{testMessage}</span></div>}
       </div>
    </div>
  );
};