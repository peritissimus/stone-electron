/**
 * Shortcuts Hook - React hooks for keyboard shortcuts access
 *
 * Components should use these hooks instead of importing useShortcutsStore directly.
 */

import { useCallback, useMemo } from 'react';
import {
  useShortcutsStore,
  DEFAULT_SHORTCUTS,
  formatShortcutDisplay,
  getShortcutsByCategory,
  type ShortcutAction,
  type ShortcutDefinition,
  type ShortcutBinding,
} from '@renderer/stores/shortcutsStore';

/**
 * Main Shortcuts hook - provides access to shortcuts state and actions
 */
export function useShortcuts() {
  const customBindings = useShortcutsStore((s) => s.customBindings);
  const getShortcut = useShortcutsStore((s) => s.getShortcut);
  const setShortcut = useShortcutsStore((s) => s.setShortcut);
  const resetShortcut = useShortcutsStore((s) => s.resetShortcut);
  const resetAllShortcuts = useShortcutsStore((s) => s.resetAllShortcuts);
  const isCustomized = useShortcutsStore((s) => s.isCustomized);

  // Get all shortcuts with current bindings
  const allShortcuts = useMemo(() => {
    return DEFAULT_SHORTCUTS.map((shortcut) => getShortcut(shortcut.id));
  }, [customBindings, getShortcut]);

  // Get shortcuts grouped by category
  const shortcutsByCategory = useMemo(() => {
    return getShortcutsByCategory();
  }, [customBindings]);

  return {
    // State
    customBindings,
    allShortcuts,
    shortcutsByCategory,

    // Actions
    getShortcut,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    isCustomized,

    // Utilities
    formatShortcutDisplay,
  };
}

/**
 * Get a single shortcut definition
 */
export function useShortcut(id: ShortcutAction): ShortcutDefinition {
  const getShortcut = useShortcutsStore((s) => s.getShortcut);
  const customBindings = useShortcutsStore((s) => s.customBindings);

  // Re-compute when customBindings change
  return useMemo(() => getShortcut(id), [id, customBindings, getShortcut]);
}

/**
 * Get formatted display string for a shortcut
 */
export function useShortcutDisplay(id: ShortcutAction): string {
  const shortcut = useShortcut(id);
  return formatShortcutDisplay(shortcut);
}

/**
 * Hook to manage a specific shortcut's customization
 */
export function useShortcutEditor(id: ShortcutAction) {
  const shortcut = useShortcut(id);
  const setShortcut = useShortcutsStore((s) => s.setShortcut);
  const resetShortcut = useShortcutsStore((s) => s.resetShortcut);
  const isCustomized = useShortcutsStore((s) => s.isCustomized);

  const updateBinding = useCallback(
    (binding: ShortcutBinding) => {
      setShortcut(id, binding);
    },
    [id, setShortcut],
  );

  const reset = useCallback(() => {
    resetShortcut(id);
  }, [id, resetShortcut]);

  return {
    shortcut,
    isCustomized: isCustomized(id),
    displayString: formatShortcutDisplay(shortcut),
    updateBinding,
    reset,
  };
}

/**
 * Read-only hook for components that just need to display shortcuts
 */
export function useShortcutsDisplay() {
  const customBindings = useShortcutsStore((s) => s.customBindings);
  const getShortcut = useShortcutsStore((s) => s.getShortcut);

  const getDisplayString = useCallback(
    (id: ShortcutAction): string => {
      const shortcut = getShortcut(id);
      return formatShortcutDisplay(shortcut);
    },
    [customBindings, getShortcut],
  );

  return {
    getDisplayString,
    formatShortcutDisplay,
  };
}

// Re-export types and utilities for convenience
export type { ShortcutAction, ShortcutDefinition, ShortcutBinding };
export { DEFAULT_SHORTCUTS, formatShortcutDisplay };
