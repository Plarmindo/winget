/**
 * Structured logging utility for the application
 * Replaces console.log with proper log levels that respect environment
 */
/* eslint-disable no-console -- this logger is the sanctioned wrapper around the console API */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDev: boolean;

  constructor() {
    this.isDev = import.meta.env.DEV;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]) {
    const timestamp = new Date().toISOString();

    // In development, log everything
    // In production, only log warn and error
    const shouldLog = this.isDev || level === 'warn' || level === 'error';

    if (shouldLog) {
      const prefix = `[${level.toUpperCase()}] ${timestamp}`;

      switch (level) {
        case 'debug':
          console.log(prefix, message, ...args);
          break;
        case 'info':
          console.info(prefix, message, ...args);
          break;
        case 'warn':
          console.warn(prefix, message, ...args);
          break;
        case 'error':
          console.error(prefix, message, ...args);
          break;
      }
    }

    // Future: Could send errors to monitoring service here
    // if (level === 'error' && !this.isDev) {
    //   sendToSentry(entry);
    // }
  }

  /**
   * Debug logs - only shown in development
   * Use for verbose logging during development
   */
  debug(message: string, ...args: unknown[]) {
    this.log('debug', message, ...args);
  }

  /**
   * Info logs - shown in all environments
   * Use for important application events
   */
  info(message: string, ...args: unknown[]) {
    this.log('info', message, ...args);
  }

  /**
   * Warning logs - shown in all environments
   * Use for recoverable errors or suspicious behavior
   */
  warn(message: string, ...args: unknown[]) {
    this.log('warn', message, ...args);
  }

  /**
   * Error logs - shown in all environments
   * Use for unrecoverable errors
   */
  error(message: string, ...args: unknown[]) {
    this.log('error', message, ...args);
  }
}

export const logger = new Logger();
