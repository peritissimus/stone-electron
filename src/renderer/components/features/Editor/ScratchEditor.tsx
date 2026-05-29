/**
 * ScratchEditor — renders the rich-text editor bound to an arbitrary .md file on disk.
 *
 * Reads the file path from the URL (`/scratch?path=<encoded absolute path>`),
 * loads content via scratchAPI, and saves back to the same path on ⌘S.
 * No workspace, no DB entry, no sidebar file-tree membership. Navigating
 * away discards any in-memory state.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RichTextEditorContent, useRichTextEditor } from '@renderer/editor';
import { useScratchDocument } from '@renderer/hooks/useScratchDocument';
import { logger } from '@renderer/lib/logger';

export function ScratchEditor() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const path = params.get('path');

  const editor = useRichTextEditor();
  const { status, error, name, isDirty, save } = useScratchDocument(editor, path);

  // ⌘S / Ctrl+S saves. Scoped here (not via useAppShortcuts) so the
  // binding is bound to the scratch route and doesn't leak when the user
  // navigates back to normal notes.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod || event.key !== 's') return;
      event.preventDefault();
      void save().catch((err) => logger.error('[Scratch] Save failed:', err));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  // Warn on navigation away with unsaved changes. Blocking truly requires
  // a router blocker; this just logs loudly so we catch it in telemetry.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  if (!path) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        <div className="text-center space-y-3">
          <p>No file selected.</p>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border border-border hover:bg-accent/20 transition-colors"
            onClick={() => navigate('/home')}
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{name ?? 'Loading…'}</span>
          {isDirty && (
            <span className="text-xs text-muted-foreground" aria-label="Unsaved changes">
              · unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-muted-foreground tabular-nums truncate max-w-[400px]"
            title={path}
          >
            {path}
          </span>
          <button
            type="button"
            className="px-2 py-1 rounded-md text-xs border border-border hover:bg-accent/20 transition-colors disabled:opacity-50"
            onClick={() => void save()}
            disabled={!isDirty || status !== 'ready'}
          >
            Save
          </button>
        </div>
      </div>

      {status === 'error' && (
        <div className="px-4 py-2 text-sm text-destructive border-b border-border bg-destructive/5">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto bg-background">
        <div className="max-w-[900px] mx-auto px-16 py-12">
          <RichTextEditorContent
            editor={editor}
            className="prose prose-stone dark:prose-invert max-w-none focus-within:outline-hidden min-h-[300px]"
          />
        </div>
      </div>
    </div>
  );
}
