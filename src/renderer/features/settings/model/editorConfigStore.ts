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
import { createSettingsHydrator } from '@renderer/services/settings/createSettingsHydrator';
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

const editorHydrator = createSettingsHydrator<EditorConfigState, EditorSettings>({
  scope: 'editor',
  load: settingsAPI.getEditor,
  apply: (settings, { event, set, get }) =>
    set({
      settings,
      loaded: true,
      staleForOpenEditor: event && get().loaded,
    }),
  fail: (_error, { set }) => set({ loaded: true }),
  fallbackMessage: 'Failed to load editor settings',
});

export const useEditorConfigStore = create<EditorConfigState>((set, get) => ({
  settings: DEFAULT_EDITOR_SETTINGS,
  loaded: false,
  staleForOpenEditor: false,

  hydrate: () => editorHydrator.hydrate(set, get),

  acknowledgeOpenEditor: () => set({ staleForOpenEditor: false }),
}));
