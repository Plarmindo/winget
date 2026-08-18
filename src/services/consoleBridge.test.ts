import { describe, expect, it, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => {
    invokeMock(...args);
    return Promise.resolve();
  },
}));

const isTauriMock = vi.fn();
vi.mock('./tauriBridge', () => ({
  isTauri: () => isTauriMock(),
}));

import { initConsoleBridge } from './consoleBridge';

describe('consoleBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(true);
  });

  it('forwards console.log as info', () => {
    initConsoleBridge();
    console.log('hello', 'world');
    expect(invokeMock).toHaveBeenCalledWith('log_frontend_message', {
      level: 'info',
      message: 'hello world',
    });
  });

  it('forwards console.error as error', () => {
    initConsoleBridge();
    console.error('boom');
    expect(invokeMock).toHaveBeenCalledWith('log_frontend_message', {
      level: 'error',
      message: 'boom',
    });
  });

  it('forwards console.warn and console.debug with their levels', () => {
    initConsoleBridge();
    console.warn('careful');
    console.debug('verbose');
    expect(invokeMock).toHaveBeenCalledWith('log_frontend_message', {
      level: 'warn',
      message: 'careful',
    });
    expect(invokeMock).toHaveBeenCalledWith('log_frontend_message', {
      level: 'debug',
      message: 'verbose',
    });
  });

  it('stringifies non-string arguments', () => {
    initConsoleBridge();
    console.error('failed:', { code: 42 });
    expect(invokeMock).toHaveBeenCalledWith('log_frontend_message', {
      level: 'error',
      message: 'failed: {"code":42}',
    });
  });

  it('does not forward when not running inside Tauri', () => {
    isTauriMock.mockReturnValue(false);
    initConsoleBridge();
    console.log('web mode');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('forwards unhandled promise rejections as errors', () => {
    initConsoleBridge();
    // jsdom has no PromiseRejectionEvent; synthesize one with a reason property
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: new Error('rejected!') });
    window.dispatchEvent(event);
    expect(invokeMock).toHaveBeenCalledWith(
      'log_frontend_message',
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('Unhandled promise rejection: Error: rejected!'),
      })
    );
  });

  it('forwards window errors as errors', () => {
    initConsoleBridge();
    window.dispatchEvent(new ErrorEvent('error', { message: 'ReferenceError: x is not defined' }));
    expect(invokeMock).toHaveBeenCalledWith('log_frontend_message', {
      level: 'error',
      message: 'Uncaught ReferenceError: x is not defined',
    });
  });

  it('keeps original console output intact', () => {
    const originalLog = console.log;
    const spy = vi.fn();
    console.log = spy;
    initConsoleBridge();
    console.log('still works');
    expect(spy).toHaveBeenCalledWith('still works');
    console.log = originalLog;
  });
});
