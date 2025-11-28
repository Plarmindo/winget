import React from 'react';
import { Activity, WifiOff, FileWarning, AlertCircle } from 'lucide-react';

export const getErrorDetails = (errorMsg: string) => {
  if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      title: 'API Quota Exceeded',
      description: 'You have reached the usage limit for the selected AI provider. This is common with free tiers.',
      hint: 'Try switching providers in Settings, upgrading your plan, or waiting a few minutes.',
      action: 'settings',
      icon: <Activity size={48} />
    };
  }
  if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Connection failed') || errorMsg.includes('NetworkError')) {
    return {
      title: 'Connection Error',
      description: 'Unable to connect to the AI provider. This often happens with local models (Ollama) due to browser security (Mixed Content) or if the server is unreachable.',
      hint: 'If using Ollama locally, ensure your browser allows mixed content or the server is running with correct CORS settings.',
      action: 'settings',
      icon: <WifiOff size={48} />
    };
  }
  if (errorMsg.includes('JSON') || errorMsg.includes('parsing') || errorMsg.includes('SyntaxError')) {
    return {
      title: 'Data Parsing Error',
      description: 'The AI provider returned a response that could not be processed correctly. It might have hallucinated invalid data structure.',
      hint: 'Try refining your search term to be more specific, or try again.',
      action: 'retry',
      icon: <FileWarning size={48} />
    };
  }
  return {
    title: 'Search Failed',
    description: errorMsg,
    hint: 'Check your AI configuration in Settings or try a different search.',
    action: 'settings',
    icon: <AlertCircle size={48} />
  };
};
