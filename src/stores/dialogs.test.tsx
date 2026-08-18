import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useToastStore, showToast } from './toastStore';
import { useConfirmStore, confirmDialog } from './confirmStore';
import { Toaster } from '../components/Toaster';
import { ConfirmDialog } from '../components/ConfirmDialog';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a toast with the given message and type', () => {
    showToast('Hello world', 'success');
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello world');
    expect(toasts[0].type).toBe('success');
  });

  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers();
    showToast('Goodbye');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('dismisses a toast manually', () => {
    showToast('Bye');
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().dismissToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('Toaster', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('renders toasts and dismisses them on click', () => {
    render(<Toaster />);
    act(() => {
      showToast('Something happened', 'warning');
    });
    expect(screen.getByText('Something happened')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByText('Something happened')).not.toBeInTheDocument();
  });
});

describe('confirmStore', () => {
  beforeEach(() => {
    useConfirmStore.setState({ isOpen: false, options: null, pending: null });
  });

  it('resolves true when confirmed', async () => {
    const promise = confirmDialog({ title: 'Sure?', message: 'Proceed?' });
    useConfirmStore.getState().resolveConfirm(true);
    await expect(promise).resolves.toBe(true);
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });

  it('resolves false when cancelled', async () => {
    const promise = confirmDialog('Delete?');
    useConfirmStore.getState().resolveConfirm(false);
    await expect(promise).resolves.toBe(false);
  });

  it('cancels a previously open dialog when a new one is requested', async () => {
    const first = confirmDialog('First?');
    const second = confirmDialog('Second?');
    await expect(first).resolves.toBe(false);
    useConfirmStore.getState().resolveConfirm(true);
    await expect(second).resolves.toBe(true);
  });
});

describe('ConfirmDialog', () => {
  beforeEach(() => {
    useConfirmStore.setState({ isOpen: false, options: null, pending: null });
  });

  it('renders the dialog and resolves true on confirm click', async () => {
    render(<ConfirmDialog />);
    let result: boolean | null = null;
    act(() => {
      confirmDialog({ title: 'Sure?', message: 'Proceed?', confirmLabel: 'OK' }).then((r) => (result = r));
    });
    expect(screen.getByText('Proceed?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(result).toBe(true));
    expect(screen.queryByText('Proceed?')).not.toBeInTheDocument();
  });

  it('cancels on Escape', async () => {
    render(<ConfirmDialog />);
    let result: boolean | null = null;
    act(() => {
      confirmDialog('Cancel me?').then((r) => (result = r));
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(result).toBe(false));
    expect(screen.queryByText('Cancel me?')).not.toBeInTheDocument();
  });
});
