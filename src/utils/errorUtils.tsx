import React from 'react';
import { Activity, WifiOff, AlertCircle, ShieldAlert, PackageX, Terminal } from 'lucide-react';
import { WingetErrorCode } from '../types';

interface ErrorDetails {
  title: string;
  description: string;
  hint?: string;
  action?: 'settings' | 'retry' | 'admin' | 'none';
  icon: React.ReactNode;
}

export const getErrorDetails = (error: unknown): ErrorDetails => {
  // Handle structured WingetError
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: WingetErrorCode }).code;
    const details = ((error as { details?: Record<string, unknown> }).details ?? {}) as Record<string, unknown>;

    switch (code) {
      case 'INSUFFICIENT_PRIVILEGES':
        return {
          title: 'Administrator Privileges Required',
          description: (details.help as string | undefined) || 'This operation requires administrator rights.',
          hint: 'Please restart the application as Administrator.',
          action: 'admin',
          icon: <ShieldAlert size={48} className="text-red-500" />,
        };

      case 'PACKAGE_NOT_FOUND':
        return {
          title: 'Package Not Found',
          description: `Could not find package '${(details.query as string | undefined) || 'requested'}'.`,
          hint:
            Array.isArray(details.suggestions) && details.suggestions.length > 0
              ? `Did you mean: ${details.suggestions.join(', ')}?`
              : 'Check the package ID and try again.',
          action: 'retry',
          icon: <PackageX size={48} className="text-orange-500" />,
        };

      case 'NETWORK_ERROR':
        return {
          title: 'Network Error',
          description: (details.message as string | undefined) || 'Unable to connect to package source.',
          hint: 'Check your internet connection and try again.',
          action: 'retry',
          icon: <WifiOff size={48} className="text-red-500" />,
        };

      case 'COMMAND_FAILED':
        return {
          title: 'Command Failed',
          description: `The operation failed with exit code ${details.exit_code as number | undefined}.`,
          hint: (details.stderr_preview as string | undefined)
            ? `Error output: ${details.stderr_preview}`
            : 'Check the logs for more details.',
          action: 'retry',
          icon: <Terminal size={48} className="text-red-500" />,
        };
    }
  }

  // Fallback to string matching for legacy/unknown errors
  const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error';

  if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      title: 'API Quota Exceeded',
      description: 'You have reached the usage limit for the selected AI provider.',
      hint: 'Try switching providers in Settings or waiting a few minutes.',
      action: 'settings',
      icon: <Activity size={48} />,
    };
  }

  return {
    title: 'Operation Failed',
    description: errorMsg,
    hint: 'Check your configuration or try again.',
    action: 'none',
    icon: <AlertCircle size={48} />,
  };
};
