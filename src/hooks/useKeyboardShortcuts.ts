import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: () => void;
  description: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Exception: Allow Escape to blur inputs
        if (event.key !== 'Escape') return;
      }

      for (const shortcut of shortcuts) {
        const ctrlPressed = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftPressed = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altPressed = shortcut.alt ? event.altKey : !event.altKey;
        const metaPressed = shortcut.meta ? event.metaKey : !event.metaKey;

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlPressed &&
          shiftPressed &&
          altPressed &&
          metaPressed
        ) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
};

// Keyboard shortcut registry for help display
export const KEYBOARD_SHORTCUTS = {
  COMMAND_PALETTE: { key: 'k', ctrl: true, label: 'Ctrl+K', description: 'Open command palette' },
  MODE_INSTALL: { key: '1', ctrl: true, label: 'Ctrl+1', description: 'Switch to Install mode' },
  MODE_UPGRADE: { key: '2', ctrl: true, label: 'Ctrl+2', description: 'Switch to Upgrade mode' },
  MODE_UNINSTALL: { key: '3', ctrl: true, label: 'Ctrl+3', description: 'Switch to Uninstall mode' },
  MODE_GITHUB: { key: '4', ctrl: true, label: 'Ctrl+4', description: 'Switch to GitHub mode' },
  FOCUS_SEARCH: { key: 'f', ctrl: true, label: 'Ctrl+F', description: 'Focus search box' },
  OPEN_CART: { key: 'c', ctrl: true, shift: true, label: 'Ctrl+Shift+C', description: 'Open cart/script drawer' },
  OPEN_SETTINGS: { key: ',', ctrl: true, label: 'Ctrl+,', description: 'Open settings' },
  OPEN_HELP: { key: '/', ctrl: true, label: 'Ctrl+/', description: 'Open help' },
  CLOSE_MODAL: { key: 'Escape', label: 'Escape', description: 'Close modal/dialog' },
} as const;
