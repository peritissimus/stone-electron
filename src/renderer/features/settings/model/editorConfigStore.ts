/**
 * Editor Config Store
 *
 * Holds the typed EditorSettings sourced from main process AppConfig
 * (config.json). Hydrated on boot via IPC; re-syncs on settings:changed
 * events with scope === 'editor'.
 *
 * Consumers (useRichTextEditor / buildEditorExtensions) read from this store
 * at editor mount time. Live updates while a document is open surface a
 * "reload to apply" banner rather than re-creating the editor.
 */

import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import { DEFAULT_EDITOR_SETTINGS, type EditorSettings } from '@shared/types/settings';

interface EditorConfigState {
  /** Current editor settings (defaults until hydrated). */
  settings: EditorSettings;
  /** True once the first hydrate() has resolved. */
  loaded: boolean;
  /**
   * True when the in-memory settings have changed from what the live editor
   * was constructed with. UI uses this to surface a "reload to apply" banner.
   */
  staleForOpenEditor: boolean;

  hydrate: () => Promise<void>;
  /** Mark the live editor as in-sync with current settings (called on remount). */
  acknowledgeOpenEditor: () => void;
}

let hydrationPromise: Promise<void> | null = null;
let eventUnsubscribe: (() => void) | null = null;

export const useEditorConfigStore = create<EditorConfigState>((set, get) => ({
  settings: DEFAULT_EDITOR_SETTINGS,
  loaded: false,
  staleForOpenEditor: false,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      try {
        const response = await settingsAPI.getEditor();
        if (response.success && response.data) {
          set({ settings: response.data, loaded: true });
        } else {
          set({ loaded: true });
        }
      } catch {
        set({ loaded: true });
      }

      if (!eventUnsubscribe) {
        eventUnsubscribe = subscribe(EVENTS.SETTINGS_CHANGED, async (payload) => {
          const scope = (payload as { scope?: string } | undefined)?.scope;
          if (scope !== 'editor') return;
          try {
            const response = await settingsAPI.getEditor();
            if (response.success && response.data) {
              const wasLoaded = get().loaded;
              set({
                settings: response.data,
                staleForOpenEditor: wasLoaded,
              });
            }
          } catch {
            // Ignore; next hydrate will catch up.
          }
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  acknowledgeOpenEditor: () => set({ staleForOpenEditor: false }),
}));
