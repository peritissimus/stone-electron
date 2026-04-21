/**
 * useEditorConfig — selector hook over editorConfigStore.
 *
 * Exposes the current EditorSettings plus the `staleForOpenEditor` flag that
 * Step 6 will use to drive the "reload note to apply" banner.
 */

import { useEditorConfigStore } from '@renderer/stores/editorConfigStore';
import type { EditorSettings } from '@shared/types/settings';

export function useEditorConfig(): {
  settings: EditorSettings;
  loaded: boolean;
  staleForOpenEditor: boolean;
  acknowledgeOpenEditor: () => void;
} {
  const settings = useEditorConfigStore((s) => s.settings);
  const loaded = useEditorConfigStore((s) => s.loaded);
  const staleForOpenEditor = useEditorConfigStore((s) => s.staleForOpenEditor);
  const acknowledgeOpenEditor = useEditorConfigStore((s) => s.acknowledgeOpenEditor);
  return { settings, loaded, staleForOpenEditor, acknowledgeOpenEditor };
}
