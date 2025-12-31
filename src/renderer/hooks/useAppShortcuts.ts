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
  onNewPersonalNote?: () => void;
  onNewWorkNote?: () => void;
  onCloseNote?: () => void;
  onTodayJournal?: () => void;
}

/**
 * Hook that sets up all application keyboard shortcuts
 * Uses the shortcuts store for keybindings and connects them to actual actions
 */
export function useAppShortcuts(options: UseAppShortcutsOptions = {}) {
  const { onSave, onNewNote, onNewPersonalNote, onNewWorkNote, onCloseNote, onTodayJournal } = options;

  const { getShortcut } = useShortcutsStore();
  const { openSettings, closeSettings, settingsOpen, toggleSidebar, toggleCommandCenter, toggleFileSwitcher } = useUIStore();
  const { setActiveNote } = useNoteStore();

  // Action handlers mapped by shortcut ID
  const actionHandlers = useMemo<Record<ShortcutAction, () => void>>(
    () => ({
      save: () => onSave?.(),
      newNote: () => onNewNote?.(),
      newPersonalNote: () => onNewPersonalNote?.(),
      newWorkNote: () => onNewWorkNote?.(),
      settings: () => {
        if (settingsOpen) {
          closeSettings();
        } else {
          openSettings();
        }
      },
      search: () => toggleCommandCenter(),
      fileSwitcher: () => toggleFileSwitcher(),
      toggleSidebar: () => toggleSidebar(),
      goHome: () => setActiveNote(null),
      closeNote: () => {
        onCloseNote?.();
        setActiveNote(null);
      },
      todayJournal: () => onTodayJournal?.(),
    }),
    [onSave, onNewNote, onNewPersonalNote, onNewWorkNote, onCloseNote, onTodayJournal, openSettings, closeSettings, settingsOpen, toggleCommandCenter, toggleFileSwitcher, toggleSidebar, setActiveNote]
  );

  // Build shortcuts config from store
  const shortcuts = useMemo<ShortcutConfig[]>(() => {
    const shortcutIds: ShortcutAction[] = [
      'save',
      'newNote',
      'newPersonalNote',
      'newWorkNote',
      'settings',
      'search',
      'fileSwitcher',
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
