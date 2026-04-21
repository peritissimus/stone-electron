/**
 * Keyboard Shortcuts Store
 *
 * State for keyboard shortcut customization. Storage backend is the typed
 * AppConfig in main process (config.json) — the renderer hydrates from IPC
 * on boot and re-syncs on settings:changed events.
 *
 * Public surface preserved for backwards compatibility with existing UI
 * (KeyboardShortcutsSettings, useShortcuts, useAppShortcuts). Internally
 * the new sparse-override ShortcutsConfig is the canonical representation;
 * the legacy `ShortcutBinding` ({ key, metaKey, shiftKey, altKey }) shape
 * is derived on the fly via shared chord-parsing utilities.
 */

import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import { DEFAULT_APP_SHORTCUTS } from '@shared/constants/defaultShortcuts';
import {
  DEFAULT_SHORTCUTS_CONFIG,
  type AppShortcutAction,
  type ShortcutsConfig,
} from '@shared/types/settings';
import { parseChord } from '@shared/utils/shortcuts';

/**
 * Shortcut action identifiers — alias for the shared type so existing UI
 * imports keep working.
 */
export type ShortcutAction = AppShortcutAction;

/**
 * Display metadata for app shortcuts. Lives in the renderer because it's
 * UI-only (labels, categories) and changes independently of chord strings.
 */
const APP_SHORTCUT_META: Record<
  AppShortcutAction,
  { label: string; description: string; category: 'general' | 'navigation' | 'editor' }
> = {
  settings: {
    label: 'Open Settings',
    description: 'Open the settings panel',
    category: 'general',
  },
  commandCenter: {
    label: 'Command Center',
    description: 'Open command center to search and run commands',
    category: 'general',
  },
  toggleSidebar: {
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    category: 'navigation',
  },
  goHome: {
    label: 'Go Home',
    description: 'Navigate to home page',
    category: 'navigation',
  },
  todayJournal: {
    label: "Today's Journal",
    description: "Open or create today's journal entry",
    category: 'navigation',
  },
  save: {
    label: 'Save',
    description: 'Save the current note',
    category: 'editor',
  },
  newNote: {
    label: 'New Note',
    description: 'Create a new note',
    category: 'editor',
  },
  newPersonalNote: {
    label: 'New Personal Note',
    description: 'Create a new note in Personal folder',
    category: 'editor',
  },
  newWorkNote: {
    label: 'New Work Note',
    description: 'Create a new note in Work folder',
    category: 'editor',
  },
  closeNote: {
    label: 'Close Note',
    description: 'Close the current note',
    category: 'editor',
  },
  findReplace: {
    label: 'Find & Replace',
    description: 'Find and replace text in the current note',
    category: 'editor',
  },
  toggleEditorMode: {
    label: 'Toggle Editor Mode',
    description: 'Switch between rich text and raw markdown',
    category: 'editor',
  },
};

/**
 * Shortcut definition exposed to UI.
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
 * Custom shortcut binding (object form expected by legacy UI).
 */
export interface ShortcutBinding {
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

// ---------------------------------------------------------------------------
// chord ↔ ShortcutBinding conversion
// ---------------------------------------------------------------------------

function chordToBinding(chord: string): ShortcutBinding | null {
  const parsed = parseChord(chord);
  if (!parsed) return null;
  return {
    key: parsed.key,
    metaKey: parsed.modifiers.includes('Mod'),
    shiftKey: parsed.modifiers.includes('Shift'),
    altKey: parsed.modifiers.includes('Alt'),
  };
}

function bindingToChord(binding: ShortcutBinding): string {
  const parts: string[] = [];
  if (binding.metaKey) parts.push('Mod');
  if (binding.altKey) parts.push('Alt');
  if (binding.shiftKey) parts.push('Shift');
  parts.push(binding.key);
  return parts.join('-');
}

function firstChord(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
}

// ---------------------------------------------------------------------------
// DEFAULT_SHORTCUTS — derived from shared defaults + renderer-only metadata
// ---------------------------------------------------------------------------

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = (
  Object.keys(DEFAULT_APP_SHORTCUTS) as AppShortcutAction[]
).map((id) => {
  const meta = APP_SHORTCUT_META[id];
  const binding = chordToBinding(DEFAULT_APP_SHORTCUTS[id]) ?? {
    key: '',
    metaKey: false,
    shiftKey: false,
    altKey: false,
  };
  return {
    id,
    ...meta,
    ...binding,
  };
});

const DEFAULT_BY_ID: Record<ShortcutAction, ShortcutDefinition> = Object.fromEntries(
  DEFAULT_SHORTCUTS.map((s) => [s.id, s]),
) as Record<ShortcutAction, ShortcutDefinition>;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ShortcutsState {
  /** Sparse overrides — canonical shape, mirrors AppConfig.shortcuts. */
  overrides: ShortcutsConfig;
  /** True once the first hydrate() call has resolved. */
  loaded: boolean;

  /** Legacy projection of overrides.app for the existing UI. */
  customBindings: Record<ShortcutAction, ShortcutBinding | null>;

  /** Async hydration from main process; safe to call multiple times. */
  hydrate: () => Promise<void>;

  // Legacy synchronous getters/queries (read from local state).
  getShortcut: (id: ShortcutAction) => ShortcutDefinition;
  isCustomized: (id: ShortcutAction) => boolean;

  // Mutations — async (round-trip through IPC).
  setShortcut: (id: ShortcutAction, binding: ShortcutBinding) => Promise<void>;
  resetShortcut: (id: ShortcutAction) => Promise<void>;
  resetAllShortcuts: () => Promise<void>;
}

function projectCustomBindings(
  overrides: ShortcutsConfig,
): Record<ShortcutAction, ShortcutBinding | null> {
  const out = {} as Record<ShortcutAction, ShortcutBinding | null>;
  for (const id of Object.keys(DEFAULT_APP_SHORTCUTS) as AppShortcutAction[]) {
    const chord = firstChord(overrides.app[id]);
    out[id] = chord ? chordToBinding(chord) : null;
  }
  return out;
}

let hydrationPromise: Promise<void> | null = null;
let eventUnsubscribe: (() => void) | null = null;

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  overrides: DEFAULT_SHORTCUTS_CONFIG,
  loaded: false,
  customBindings: projectCustomBindings(DEFAULT_SHORTCUTS_CONFIG),

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      try {
        const response = await settingsAPI.getShortcuts();
        const overrides = response.success && response.data ? response.data : DEFAULT_SHORTCUTS_CONFIG;
        set({
          overrides,
          customBindings: projectCustomBindings(overrides),
          loaded: true,
        });
      } catch {
        // Hydration failure: surface as "loaded with defaults" so UI doesn't hang.
        set({ loaded: true });
      }

      // Subscribe once to settings:changed so future updates from the main
      // process (e.g. another window) refresh the local state.
      if (!eventUnsubscribe) {
        eventUnsubscribe = subscribe(EVENTS.SETTINGS_CHANGED, async (payload) => {
          const scope = (payload as { scope?: string } | undefined)?.scope;
          if (scope !== 'shortcuts') return;
          try {
            const response = await settingsAPI.getShortcuts();
            if (response.success && response.data) {
              set({
                overrides: response.data,
                customBindings: projectCustomBindings(response.data),
              });
            }
          } catch {
            // Ignore — local state stays as-is until next hydrate.
          }
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      // Allow re-hydration if needed (e.g. after settings imported).
      hydrationPromise = null;
    }
  },

  getShortcut: (id: ShortcutAction): ShortcutDefinition => {
    const def = DEFAULT_BY_ID[id];
    if (!def) {
      throw new Error(`Unknown shortcut: ${id}`);
    }
    const override = get().customBindings[id];
    return override ? { ...def, ...override } : def;
  },

  isCustomized: (id: ShortcutAction): boolean => {
    return get().customBindings[id] !== null;
  },

  setShortcut: async (id: ShortcutAction, binding: ShortcutBinding) => {
    const chord = bindingToChord(binding);
    const response = await settingsAPI.setShortcut({
      scope: 'app',
      action: id,
      binding: chord,
    });
    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to set shortcut');
    }
    set({
      overrides: response.data,
      customBindings: projectCustomBindings(response.data),
    });
  },

  resetShortcut: async (id: ShortcutAction) => {
    const response = await settingsAPI.resetShortcut({ scope: 'app', action: id });
    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to reset shortcut');
    }
    set({
      overrides: response.data,
      customBindings: projectCustomBindings(response.data),
    });
  },

  resetAllShortcuts: async () => {
    const response = await settingsAPI.resetAllShortcuts();
    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Failed to reset all shortcuts');
    }
    set({
      overrides: response.data,
      customBindings: projectCustomBindings(response.data),
    });
  },
}));

/**
 * Get all shortcuts grouped by category.
 */
export const getShortcutsByCategory = (): Record<string, ShortcutDefinition[]> => {
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
 * Format shortcut for display.
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

  let keyDisplay = shortcut.key.toUpperCase();
  if (shortcut.key === ',') keyDisplay = ',';
  if (shortcut.key === '\\') keyDisplay = '\\';

  parts.push(keyDisplay);

  return isMac ? parts.join('') : parts.join('+');
};
