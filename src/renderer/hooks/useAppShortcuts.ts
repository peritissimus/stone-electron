/**
 * App-level keyboard shortcuts hook
 * Integrates the shortcuts store with actual actions
 */

import { useMemo, useCallback } from 'react';
import { useShortcutsStore, type ShortcutAction } from '@renderer/stores/shortcutsStore';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useKeyboardShortcuts, ShortcutConfig, isMacOS } from './useKeyboardShortcuts';

interface UseAppShortcutsOptions {
  onSave?: () => void;
  onNewNote?: () => void;
  onCloseNote?: () => void;
  onTodayJournal?: () => void;
}

/**
 * Hook that sets up all application keyboard shortcuts
 * Uses the shortcuts store for keybindings and connects them to actual actions
 */
export function useAppShortcuts(options: UseAppShortcutsOptions = {}) {
  const { onSave, onNewNote, onCloseNote, onTodayJournal } = options;

  const { getShortcut } = useShortcutsStore();
  const { openSettings, closeSettings, settingsOpen, toggleSidebar, toggleSearch } = useUIStore();
  const { setActiveNote } = useNoteStore();

  // Action handlers mapped by shortcut ID
  const actionHandlers = useMemo<Record<ShortcutAction, () => void>>(
    () => ({
      save: () => onSave?.(),
      newNote: () => onNewNote?.(),
      settings: () => {
        if (settingsOpen) {
          closeSettings();
        } else {
          openSettings();
        }
      },
      search: () => toggleSearch(),
      toggleSidebar: () => toggleSidebar(),
      goHome: () => setActiveNote(null),
      closeNote: () => {
        onCloseNote?.();
        setActiveNote(null);
      },
      todayJournal: () => onTodayJournal?.(),
    }),
    [onSave, onNewNote, onCloseNote, onTodayJournal, openSettings, closeSettings, settingsOpen, toggleSearch, toggleSidebar, setActiveNote]
  );

  // Build shortcuts config from store
  const shortcuts = useMemo<ShortcutConfig[]>(() => {
    const shortcutIds: ShortcutAction[] = [
      'save',
      'newNote',
      'settings',
      'search',
      'toggleSidebar',
      'goHome',
      'closeNote',
      'todayJournal',
    ];

    return shortcutIds.map((id) => {
      const shortcut = getShortcut(id);
      return {
        key: shortcut.key,
        metaKey: shortcut.metaKey ? isMacOS() : undefined,
        ctrlKey: shortcut.metaKey && !isMacOS() ? true : undefined,
        shiftKey: shortcut.shiftKey || undefined,
        altKey: shortcut.altKey || undefined,
        action: actionHandlers[id],
        description: shortcut.description,
      };
    });
  }, [getShortcut, actionHandlers]);

  // Attach keyboard shortcuts
  useKeyboardShortcuts(shortcuts);
}
