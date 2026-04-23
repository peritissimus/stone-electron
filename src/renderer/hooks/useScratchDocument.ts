/**
 * useScratchDocument — binds a TipTap editor to a file on disk by absolute
 * path, outside the workspace/notes pipeline. Load on mount, save on demand.
 *
 * Intentionally sparse: no buffer store, no autosave, no draft recovery,
 * no NOTE_UPDATED events. If you're reaching for those here, you probably
 * want the normal note-editing flow instead — scratch is "open / edit /
 * ⌘S / close" and nothing else.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { scratchAPI } from '@renderer/api';
import { parseMarkdown } from '@renderer/lib/markdownParser';
import { serializeMarkdown } from '@renderer/lib/markdownSerializer';
import { logger } from '@renderer/lib/logger';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface UseScratchDocumentResult {
  status: Status;
  error: string | null;
  name: string | null;
  path: string | null;
  isDirty: boolean;
  save: () => Promise<boolean>;
}

export function useScratchDocument(
  editor: Editor | null,
  absolutePath: string | null,
): UseScratchDocumentResult {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Track the path we've loaded so we don't clobber changes while the user
  // is editing if the parent re-renders with the same path.
  const loadedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor || !absolutePath) return;
    if (loadedPathRef.current === absolutePath) return;

    let cancelled = false;
    setStatus('loading');
    setError(null);
    setIsDirty(false);

    (async () => {
      const response = await scratchAPI.read(absolutePath);
      if (cancelled) return;

      if (!response.success || !response.data) {
        setStatus('error');
        setError(response.error?.message ?? 'Failed to open file');
        logger.error('[Scratch] Failed to read file:', response.error);
        return;
      }

      try {
        const doc = parseMarkdown(response.data.content);
        editor.commands.setContent(doc);
        loadedPathRef.current = absolutePath;
        setName(response.data.name);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to parse markdown');
        logger.error('[Scratch] Failed to parse markdown:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, absolutePath]);

  // Mirror editor edits into a dirty flag. We don't keep the JSON around —
  // the editor itself is the source of truth. On save, we serialize its
  // current doc and write.
  useEffect(() => {
    if (!editor) return;
    const markDirty = () => setIsDirty(true);
    editor.on('update', markDirty);
    return () => {
      editor.off('update', markDirty);
    };
  }, [editor]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!editor || !absolutePath) return false;
    if (!isDirty) return true;

    try {
      const markdown = serializeMarkdown(editor.getJSON());
      const response = await scratchAPI.write(absolutePath, markdown);
      if (!response.success) {
        setError(response.error?.message ?? 'Failed to save file');
        logger.error('[Scratch] Failed to save file:', response.error);
        return false;
      }
      setIsDirty(false);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to serialize markdown');
      logger.error('[Scratch] Failed to save:', err);
      return false;
    }
  }, [editor, absolutePath, isDirty]);

  return {
    status,
    error,
    name,
    path: absolutePath,
    isDirty,
    save,
  };
}
