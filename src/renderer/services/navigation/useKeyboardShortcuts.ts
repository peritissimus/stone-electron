import { useEffect, useCallback } from 'react';

/**
 * Keyboard shortcut configuration
 */
export interface ShortcutConfig {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
  preventDefault?: boolean;
}

/**
 * Platform-aware keyboard shortcuts hook
 *
 * Supports:
 * - Cmd+S (save)
 * - Cmd+N (new note)
 * - Cmd+, (settings)
 * - More shortcuts can be added via config
 *
 * @param shortcuts - Array of shortcut configurations
 * @param enabled - Whether shortcuts are enabled (default: true)
 */
export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[], enabled: boolean = true) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't intercept most shortcuts in input fields (except contenteditable)
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'select';
      const isTextarea = tagName === 'textarea';

      // Allow shortcuts in contenteditable (TipTap editor)
      const isEditor = target.getAttribute('contenteditable') === 'true';

      // Allow specific shortcuts in textareas (save, mode toggle)
      const isSaveShortcut = event.key.toLowerCase() === 's' && (event.metaKey || event.ctrlKey);
      const isModeToggle =
        event.key.toLowerCase() === 'm' && (event.metaKey || event.ctrlKey) && event.shiftKey;
      const isAllowedInTextarea = isSaveShortcut || isModeToggle;

      if (isInput && !isEditor) {
        return;
      }

      // For textareas, only allow specific shortcuts
      if (isTextarea && !isAllowedInTextarea) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const metaMatch = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;
        const ctrlMatch = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const shiftMatch = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
        const altMatch = shortcut.altKey === undefined || event.altKey === shortcut.altKey;

        if (keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
};

/**
 * Helper to check if running on macOS
 */
export const isMacOS = (): boolean => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

/**
 * Get the modifier key label for current platform
 */
export const getModifierLabel = (): string => {
  return isMacOS() ? '⌘' : 'Ctrl';
};

/**
 * Format a shortcut for display
 * @example formatShortcut('s', true) => "⌘S" on Mac, "Ctrl+S" on Windows
 */
export const formatShortcut = (
  key: string,
  meta: boolean = false,
  shift: boolean = false,
  alt: boolean = false,
): string => {
  const parts: string[] = [];

  if (meta) {
    parts.push(getModifierLabel());
  }

  if (shift) {
    parts.push(isMacOS() ? '⇧' : 'Shift');
  }

  if (alt) {
    parts.push(isMacOS() ? '⌥' : 'Alt');
  }

  parts.push(key.toUpperCase());

  return isMacOS() ? parts.join('') : parts.join('+');
};
