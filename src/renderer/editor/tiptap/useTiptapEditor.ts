/**
 * Current rich-text editor implementation.
 *
 * App-facing renderer code imports this through `@renderer/editor` so TipTap
 * remains replaceable behind one boundary.
 */

import { useEffect, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import { useNoteCache } from '@renderer/hooks/useNoteCache';
import { useEditorConfigStore } from '@renderer/stores/editorConfigStore';
import { useShortcutsStore } from '@renderer/stores/shortcutsStore';
import { resolveShortcuts } from '@shared/utils/shortcuts';
import { buildEditorExtensions } from '@renderer/lib/editor/buildExtensions';
import { preloadConfiguredLanguages } from '@renderer/lib/editor/codeLanguages';

export function useRichTextEditor() {
  const { fetchNotesForAutocomplete } = useNoteCache();

  // Snapshot config + overrides at editor mount. Subsequent changes
  // mark staleForOpenEditor; they don't re-mount the editor.
  const initialConfigRef = useRef<{
    editorConfig: ReturnType<typeof useEditorConfigStore.getState>['settings'];
    overrides: ReturnType<typeof useShortcutsStore.getState>['overrides'];
  } | null>(null);

  if (!initialConfigRef.current) {
    initialConfigRef.current = {
      editorConfig: useEditorConfigStore.getState().settings,
      overrides: useShortcutsStore.getState().overrides,
    };
  }

  const { editorConfig, overrides } = initialConfigRef.current;
  const shortcuts = resolveShortcuts(overrides);

  // Preload the configured language list once. The set is cached internally
  // in codeLanguages.ts so duplicate calls are cheap.
  useEffect(() => {
    void preloadConfiguredLanguages(editorConfig.codeBlock.preloadLanguages);
  }, [editorConfig.codeBlock.preloadLanguages]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildEditorExtensions({
      editorConfig,
      shortcuts,
      fetchNotesForAutocomplete,
    }),
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-stone dark:prose-invert max-w-none focus:outline-hidden min-h-[400px]',
      },
    },
  });

  // Mark editor as in-sync with current settings on mount so a future change
  // properly trips the stale flag.
  useEffect(() => {
    useEditorConfigStore.getState().acknowledgeOpenEditor();
  }, []);

  return editor;
}
