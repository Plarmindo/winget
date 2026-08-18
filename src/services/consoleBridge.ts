/**
 * Console Bridge
 *
 * Forwards the desktop app's WebView2 console output into the Rust tracing
 * log (visible in `tauri-dev.log`) so frontend errors are visible from the
 * terminal during development.
 *
 * Tauri 2.x exposes no Rust-side WebView2 console hook, so we capture
 * `console.*` calls (plus uncaught errors and unhandled rejections) here and
 * ship them to the backend over IPC. Original console output is preserved so
 * DevTools still works normally.
 */
/* eslint-disable no-console -- this module is the sanctioned bridge to the console API */

import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauriBridge';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const stringify = (arg: unknown): string => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack ?? arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

const send = (level: LogLevel, message: string): void => {
  if (!isTauri()) return;
  // Fire-and-forget; the bridge must never break the app or recurse.
  invoke('log_frontend_message', { level, message }).catch(() => {
    /* backend unavailable — ignore */
  });
};

let installed = false;

/**
 * Patches `console.*` and wires uncaught-error listeners. Call once at
 * startup (before React mounts) to capture early errors.
 */
export const initConsoleBridge = (): void => {
  if (installed) return;
  installed = true;

  const originals: Record<LogLevel, (...args: unknown[]) => void> = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  const patch = (level: LogLevel): void => {
    (console as unknown as Record<string, unknown>)[level] = (...args: unknown[]): void => {
      originals[level](...args);
      send(level, args.map(stringify).join(' '));
    };
  };

  // console.log maps to the "info" level on the backend
  const originalLog = console.log.bind(console);
  console.log = (...args: unknown[]): void => {
    originalLog(...args);
    send('info', args.map(stringify).join(' '));
  };

  patch('debug');
  patch('info');
  patch('warn');
  patch('error');

  window.addEventListener('error', (event) => {
    send('error', `Uncaught ${event.message}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    send('error', `Unhandled promise rejection: ${stringify(event.reason)}`);
  });
};
