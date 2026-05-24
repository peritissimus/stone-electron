/**
 * App-level keyboard shortcuts hook
 * Integrates the shortcuts store with actual actions
 */

import { useMemo } from 'react';
import { useShortcutsStore, type ShortcutAction } from '@renderer/stores/shortcutsStore';
import { useUIStore } from '@renderer/stores/uiStore';
import { toSettings, useNavigateHome } from '@renderer/navigation';
import { useKeyboardShortcuts, ShortcutConfig, isMacOS } from './useKeyboardShortcuts';
import { useNavigate } from 'react-router-dom';

interface UseAppShortcutsOptions {
  onSave?: () => void;
  onNewNote?: () => void;
  onNewPersonalNote?: () => void;
  onNewWorkNote?: () => void;
  onCloseNote?: () => void;
  onTodayJournal?: () => void;
  onFindReplace?: () => void;
  onToggleEditorMode?: () => void;
  onFocusSidebar?: () => void;
  onOpenFile?: () => void;
}

/**
 * Hook that sets up all application keyboard shortcuts
 * Uses the shortcuts store for keybindings and connects them to actual actions
 */
export function useAppShortcuts(options: UseAppShortcutsOptions = {}) {
  const {
    onSave,
    onNewNote,
    onNewPersonalNote,
    onNewWorkNote,
    onCloseNote,
    onTodayJournal,
    onFindReplace,
    onToggleEditorMode,
    onFocusSidebar,
    onOpenFile,
  } = options;

  const navigateHome = useNavigateHome();
  const navigate = useNavigate();
  const { getShortcut } = useShortcutsStore();
  const {
    toggleSidebar,
    toggleCommandCenter,
    toggleFindReplace,
    toggleEditorMode,
    toggleAskNotes,
  } = useUIStore();

  // Action handlers mapped by shortcut ID
  const actionHandlers = useMemo<Record<ShortcutAction, () => void>>(
    () => ({
      save: () => onSave?.(),
      newNote: () => onNewNote?.(),
      newPersonalNote: () => onNewPersonalNote?.(),
      newWorkNote: () => onNewWorkNote?.(),
      settings: () => navigate(toSettings()),
      commandCenter: () => toggleCommandCenter(),
      toggleSidebar: () => toggleSidebar(),
      focusSidebar: () => onFocusSidebar?.(),
      goHome: () => navigateHome(),
      closeNote: () => {
        onCloseNote?.();
        navigateHome();
      },
      todayJournal: () => onTodayJournal?.(),
      findReplace: () => {
        onFindReplace?.();
        toggleFindReplace();
      },
      toggleEditorMode: () => {
        if (onToggleEditorMode) {
          onToggleEditorMode();
        } else {
          toggleEditorMode();
        }
      },
      openFile: () => onOpenFile?.(),
      askNotes: () => toggleAskNotes(),
    }),
    [
      onSave,
      onNewNote,
      onNewPersonalNote,
      onNewWorkNote,
      onCloseNote,
      onTodayJournal,
      onFindReplace,
      onToggleEditorMode,
      onFocusSidebar,
      onOpenFile,
      toggleCommandCenter,
      toggleFindReplace,
      toggleEditorMode,
      toggleSidebar,
      toggleAskNotes,
      navigateHome,
      navigate,
    ],
  );

  // Build shortcuts config from store
  const shortcuts = useMemo<ShortcutConfig[]>(() => {
    const shortcutIds: ShortcutAction[] = [
      'save',
      'newNote',
      'newPersonalNote',
      'newWorkNote',
      'settings',
      'commandCenter',
      'toggleSidebar',
      'focusSidebar',
      'goHome',
      'closeNote',
      'todayJournal',
      'findReplace',
      'toggleEditorMode',
      'openFile',
      'askNotes',
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
