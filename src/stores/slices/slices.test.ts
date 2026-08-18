import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createCartSlice, CartSlice } from './cartSlice';
import { createChatSlice, ChatSlice } from './chatSlice';
import { createSettingsSlice, SettingsSlice, DEFAULT_SETTINGS } from './settingsSlice';
import { createUiSlice, UiSlice } from './uiSlice';
import { WingetPackage } from '../../types';

const makePackage = (id: string, name = id): WingetPackage => ({
  id,
  name,
  version: '1.0.0',
  description: 'A test package',
  publisher: 'Tester',
  category: 'Utilities',
  isFree: true,
  source: 'winget',
});

describe('cartSlice', () => {
  it('initializes with empty collections', () => {
    const store = create<CartSlice>()(createCartSlice);
    expect(store.getState().cart).toEqual([]);
    expect(store.getState().favorites).toEqual([]);
    expect(store.getState().compareList).toEqual([]);
  });

  it('adds packages to the cart without duplicating', () => {
    const store = create<CartSlice>()(createCartSlice);
    const pkg = makePackage('Test.App');
    store.getState().addToCart(pkg);
    store.getState().addToCart(pkg);
    store.getState().addToCart(makePackage('Other.App'));
    expect(store.getState().cart).toHaveLength(2);
    expect(store.getState().isInCart('Test.App')).toBe(true);
    expect(store.getState().isInCart('Missing.App')).toBe(false);
  });

  it('removes packages and clears the cart', () => {
    const store = create<CartSlice>()(createCartSlice);
    store.getState().addToCart(makePackage('Test.App'));
    store.getState().addToCart(makePackage('Other.App'));
    store.getState().removeFromCart('Test.App');
    expect(store.getState().cart.map((p) => p.id)).toEqual(['Other.App']);
    store.getState().clearCart();
    expect(store.getState().cart).toEqual([]);
  });

  it('toggles favorites', () => {
    const store = create<CartSlice>()(createCartSlice);
    store.getState().toggleFavorite('Test.App');
    expect(store.getState().isFavorite('Test.App')).toBe(true);
    store.getState().toggleFavorite('Test.App');
    expect(store.getState().isFavorite('Test.App')).toBe(false);
  });

  it('toggles comparison entries', () => {
    const store = create<CartSlice>()(createCartSlice);
    const a = makePackage('A.App');
    const b = makePackage('B.App');
    store.getState().toggleCompare(a);
    store.getState().toggleCompare(b);
    expect(store.getState().compareList.map((p) => p.id)).toEqual(['A.App', 'B.App']);
    store.getState().toggleCompare(a);
    expect(store.getState().compareList.map((p) => p.id)).toEqual(['B.App']);
    store.getState().clearCompare();
    expect(store.getState().compareList).toEqual([]);
  });
});

describe('chatSlice', () => {
  it('appends messages with metadata', () => {
    const store = create<ChatSlice>()(createChatSlice);
    store.getState().addChatMessage({ role: 'user', text: 'hello' });
    store.getState().addChatMessage({ role: 'model', text: 'hi', sources: [{ uri: 'https://x', title: 'X' }] });
    const messages = store.getState().chatMessages;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', text: 'hello' });
    expect(messages[0].id).toBeTruthy();
    expect(messages[0].timestamp).toBeGreaterThan(0);
    expect(messages[1].sources).toEqual([{ uri: 'https://x', title: 'X' }]);
  });

  it('replaces and clears messages', () => {
    const store = create<ChatSlice>()(createChatSlice);
    store.getState().addChatMessage({ role: 'user', text: 'old' });
    store.getState().setChatMessages([{ id: 'x', role: 'model', text: 'new', timestamp: 1 }]);
    expect(store.getState().chatMessages).toHaveLength(1);
    expect(store.getState().chatMessages[0].text).toBe('new');
    store.getState().clearChatMessages();
    expect(store.getState().chatMessages).toEqual([]);
  });

  it('stores a pending chat query', () => {
    const store = create<ChatSlice>()(createChatSlice);
    expect(store.getState().pendingChatQuery).toBe('');
    store.getState().setPendingChatQuery('upgrade chrome');
    expect(store.getState().pendingChatQuery).toBe('upgrade chrome');
  });
});

describe('settingsSlice', () => {
  it('merges partial settings updates', () => {
    const store = create<SettingsSlice>()(createSettingsSlice);
    store.getState().updateSettings({ compactMode: true, activePackageManager: 'chocolatey' });
    expect(store.getState().settings.compactMode).toBe(true);
    expect(store.getState().settings.activePackageManager).toBe('chocolatey');
    expect(store.getState().settings.reducedMotion).toBe(DEFAULT_SETTINGS.reducedMotion);
  });

  it('resets settings to defaults', () => {
    const store = create<SettingsSlice>()(createSettingsSlice);
    store.getState().updateSettings({ compactMode: true, activePackageManager: 'scoop' });
    store.getState().resetSettings();
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('uiSlice', () => {
  it('switches modes and clears search state', () => {
    const store = create<UiSlice>()(createUiSlice);
    store.getState().setPackages([makePackage('A.App')]);
    store.getState().setQuery('test');
    store.getState().setError('boom');
    store.getState().setMode('upgrade');
    expect(store.getState().mode).toBe('upgrade');
    expect(store.getState().packages).toEqual([]);
    expect(store.getState().query).toBe('');
    expect(store.getState().error).toBeNull();
  });

  it('updates query, packages, loading and error', () => {
    const store = create<UiSlice>()(createUiSlice);
    store.getState().setQuery('chrome');
    store.getState().setPackages([makePackage('A.App')]);
    store.getState().setLoading(true);
    store.getState().setError(new Error('failed'));
    expect(store.getState().query).toBe('chrome');
    expect(store.getState().packages).toHaveLength(1);
    expect(store.getState().loading).toBe(true);
    expect((store.getState().error as Error).message).toBe('failed');
    store.getState().setError(null);
    expect(store.getState().error).toBeNull();
  });

  it('sets the sort order', () => {
    const store = create<UiSlice>()(createUiSlice);
    store.getState().setSortBy('name-desc');
    expect(store.getState().sortBy).toBe('name-desc');
  });

  it('sets status messages with an info default type', () => {
    const store = create<UiSlice>()(createUiSlice);
    store.getState().setStatusMessage('working');
    expect(store.getState().statusMessage).toBe('working');
    expect(store.getState().statusType).toBe('info');
    store.getState().setStatusMessage('failed', 'error');
    expect(store.getState().statusMessage).toBe('failed');
    expect(store.getState().statusType).toBe('error');
  });

  it('prepends history entries and caps them at 100', () => {
    const store = create<UiSlice>()(createUiSlice);
    for (let i = 0; i < 105; i++) {
      store.getState().addHistoryEntry({
        operation: 'install',
        packageId: `pkg-${i}`,
        packageName: `pkg-${i}`,
        manager: 'winget',
        status: 'success',
      });
    }
    expect(store.getState().history).toHaveLength(100);
    expect(store.getState().history[0].packageId).toBe('pkg-104');
    expect(store.getState().history[0].id).toBeTruthy();
  });

  it('clears history and limits recent history lookups', () => {
    const store = create<UiSlice>()(createUiSlice);
    for (let i = 0; i < 15; i++) {
      store.getState().addHistoryEntry({
        operation: 'install',
        packageId: `pkg-${i}`,
        packageName: `pkg-${i}`,
        manager: 'winget',
        status: 'success',
      });
    }
    expect(store.getState().getRecentHistory()).toHaveLength(10);
    expect(store.getState().getRecentHistory(3)).toHaveLength(3);
    expect(store.getState().getRecentHistory(3)[0].packageId).toBe('pkg-14');
    store.getState().clearHistory();
    expect(store.getState().history).toEqual([]);
  });
});
