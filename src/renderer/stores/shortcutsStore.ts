/**
 * Keyboard Shortcuts Store - Zustand state management for keyboard shortcuts
 *
 * Note: This is an application-specific store without a spec counterpart.
 * Keyboard shortcuts are platform-specific and not typically shared across
 * language implementations.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Shortcut action identifiers
 */
export type ShortcutAction =
  | 'save'
  | 'newNote'
  | 'newPersonalNote'
  | 'newWorkNote'
  | 'settings'
  | 'commandCenter'
  | 'toggleSidebar'
  | 'goHome'
  | 'closeNote'
  | 'todayJournal'
  | 'findReplace'
  | 'toggleEditorMode';

/**
 * Shortcut definition
 */
export interface ShortcutDefinition {
  id: ShortcutAction;
  label: string;
  description: string;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  category: 'general' | 'navigation' | 'editor';
}

/**
 * Custom shortcut binding (user override)
 */
export interface ShortcutBinding {
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Default shortcuts configuration
 */
export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // General
  {
    id: 'settings',
    label: 'Open Settings',
    description: 'Open the settings panel',
    key: ',',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'general',
  },
  {
    id: 'commandCenter',
    label: 'Command Center',
    description: 'Open command center to search and run commands',
    key: 'k',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'general',
  },
  // Navigation
  {
    id: 'toggleSidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    key: '\\',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'navigation',
  },
  {
    id: 'goHome',
    label: 'Go Home',
    description: 'Navigate to home page',
    key: 'h',
    metaKey: true,
    shiftKey: true,
    altKey: false,
    category: 'navigation',
  },
  // Editor
  {
    id: 'save',
    label: 'Save',
    description: 'Save the current note',
    key: 's',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'editor',
  },
  {
    id: 'newNote',
    label: 'New Note',
    description: 'Create a new note',
    key: 'n',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'editor',
  },
  {
    id: 'newPersonalNote',
    label: 'New Personal Note',
    description: 'Create a new note in Personal folder',
    key: 'p',
    metaKey: true,
    shiftKey: true,
    altKey: false,
    category: 'editor',
  },
  {
    id: 'newWorkNote',
    label: 'New Work Note',
    description: 'Create a new note in Work folder',
    key: 'w',
    metaKey: true,
    shiftKey: true,
    altKey: false,
    category: 'editor',
  },
  {
    id: 'closeNote',
    label: 'Close Note',
    description: 'Close the current note',
    key: 'w',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'editor',
  },
  {
    id: 'todayJournal',
    label: "Today's Journal",
    description: "Open or create today's journal entry",
    key: 'j',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'navigation',
  },
  {
    id: 'findReplace',
    label: 'Find & Replace',
    description: 'Find and replace text in the current note',
    key: 'f',
    metaKey: true,
    shiftKey: false,
    altKey: false,
    category: 'editor',
  },
  {
    id: 'toggleEditorMode',
    label: 'Toggle Editor Mode',
    description: 'Switch between rich text and raw markdown',
    key: 'm',
    metaKey: true,
    shiftKey: true,
    altKey: false,
    category: 'editor',
  },
];

interface ShortcutsState {
  // Custom bindings override defaults
  customBindings: Record<ShortcutAction, ShortcutBinding | null>;

  // Actions
  getShortcut: (id: ShortcutAction) => ShortcutDefinition;
  setShortcut: (id: ShortcutAction, binding: ShortcutBinding) => void;
  resetShortcut: (id: ShortcutAction) => void;
  resetAllShortcuts: () => void;
  isCustomized: (id: ShortcutAction) => boolean;
}

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set, get) => ({
      customBindings: {} as Record<ShortcutAction, ShortcutBinding | null>,

      getShortcut: (id: ShortcutAction): ShortcutDefinition => {
        const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.id === id);
        if (!defaultShortcut) {
          throw new Error(`Unknown shortcut: ${id}`);
        }

        const customBinding = get().customBindings[id];
        if (customBinding) {
          return {
            ...defaultShortcut,
            ...customBinding,
          };
        }

        return defaultShortcut;
      },

      setShortcut: (id: ShortcutAction, binding: ShortcutBinding) => {
        set((state) => ({
          customBindings: {
            ...state.customBindings,
            [id]: binding,
          },
        }));
      },

      resetShortcut: (id: ShortcutAction) => {
        set((state) => {
          const newBindings = { ...state.customBindings };
          delete newBindings[id];
          return { customBindings: newBindings };
        });
      },

      resetAllShortcuts: () => {
        set({ customBindings: {} as Record<ShortcutAction, ShortcutBinding | null> });
      },

      isCustomized: (id: ShortcutAction): boolean => {
        return !!get().customBindings[id];
      },
    }),
    {
      name: 'stone-shortcuts',
      partialize: (state) => ({
        customBindings: state.customBindings,
      }),
    },
  ),
);

/**
 * Get all shortcuts grouped by category
 */
export const getShortcutsByCategory = () => {
  const store = useShortcutsStore.getState();
  const categories: Record<string, ShortcutDefinition[]> = {
    general: [],
    navigation: [],
    editor: [],
  };

  for (const shortcut of DEFAULT_SHORTCUTS) {
    const current = store.getShortcut(shortcut.id);
    categories[current.category].push(current);
  }

  return categories;
};

/**
 * Format shortcut for display
 */
export const formatShortcutDisplay = (shortcut: ShortcutDefinition): string => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];

  if (shortcut.metaKey) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shiftKey) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format special keys
  let keyDisplay = shortcut.key.toUpperCase();
  if (shortcut.key === ',') keyDisplay = ',';
  if (shortcut.key === '\\') keyDisplay = '\\';

  parts.push(keyDisplay);

  return isMac ? parts.join('') : parts.join('+');
};
