/**
 * useEditorMode Hook - Manages rich/raw editor mode switching
 *
 * Encapsulates:
 * - Mode state (rich vs raw)
 * - Raw markdown state
 * - Mode switching with content conversion
 * - Reset on note change
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { Editor } from '@tiptap/react';
import { useEditorUI } from '@renderer/hooks/useUI';
import { jsonToMarkdown } from '@renderer/utils/jsonToMarkdown';
import { logger } from '@renderer/utils/logger';

interface UseEditorModeOptions {
  editor: Editor | null;
  activeNoteId: string | null;
  isDirty: boolean;
  onSaveRaw: (markdown: string) => Promise<void>;
  onSaveRich: () => Promise<void>;
}

export function useEditorMode({
  editor,
  activeNoteId,
  isDirty,
  onSaveRaw,
  onSaveRich,
}: UseEditorModeOptions) {
  const { editorMode, setEditorMode } = useEditorUI();
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [rawDirty, setRawDirty] = useState(false);

  // Track previous mode and last synced content
  const previousModeRef = useRef(editorMode);
  const lastSyncedMarkdownRef = useRef('');

  // Handle mode switching - convert content between formats
  useEffect(() => {
    if (!editor) return;

    const prevMode = previousModeRef.current;
    previousModeRef.current = editorMode;

    // Skip if mode hasn't changed
    if (prevMode === editorMode) return;

    if (editorMode === 'raw') {
      // Rich → Raw: Convert TipTap JSON to markdown
      const json = editor.getJSON();
      const markdown = jsonToMarkdown(json);
      setRawMarkdown(markdown);
      lastSyncedMarkdownRef.current = markdown;
      setRawDirty(false);
      logger.info('[useEditorMode] Switched to raw mode');
    } else {
      // Raw → Rich: Convert markdown to HTML and update editor
      if (rawMarkdown !== lastSyncedMarkdownRef.current) {
        marked.setOptions({
          gfm: true,
          breaks: true,
        });

        const html = marked.parse(rawMarkdown) as string;
        editor.commands.setContent(html);
        lastSyncedMarkdownRef.current = rawMarkdown;
        setRawDirty(false);
        logger.info('[useEditorMode] Switched to rich mode, content updated');
      } else {
        logger.info('[useEditorMode] Switched to rich mode, no changes');
      }
    }
  }, [editorMode, editor, rawMarkdown]);

  // Reset to rich mode when switching notes
  useEffect(() => {
    if (editorMode === 'raw') {
      setEditorMode('rich');
    }
    setRawMarkdown('');
    lastSyncedMarkdownRef.current = '';
    setRawDirty(false);
  }, [activeNoteId, editorMode, setEditorMode]);

  // Handle raw markdown changes
  const handleRawMarkdownChange = useCallback((value: string) => {
    setRawMarkdown(value);
    setRawDirty(true);
  }, []);

  // Handle save - works in both modes
  const handleSave = useCallback(async () => {
    if (editorMode === 'raw' && rawDirty) {
      await onSaveRaw(rawMarkdown);
      setRawDirty(false);
      logger.info('[useEditorMode] Raw markdown saved');
    } else {
      await onSaveRich();
    }
  }, [editorMode, rawDirty, rawMarkdown, onSaveRaw, onSaveRich]);

  // Handle mode toggle - auto-save before switching
  const handleModeToggle = useCallback(async () => {
    const hasUnsavedChanges = editorMode === 'raw' ? rawDirty : isDirty;
    if (hasUnsavedChanges) {
      await handleSave();
      logger.info('[useEditorMode] Auto-saved before mode toggle');
    }
    return true;
  }, [editorMode, rawDirty, isDirty, handleSave]);

  // Compute whether there are unsaved changes
  const hasUnsavedChanges = editorMode === 'raw' ? rawDirty : isDirty;

  return {
    editorMode,
    rawMarkdown,
    rawDirty,
    hasUnsavedChanges,
    handleRawMarkdownChange,
    handleSave,
    handleModeToggle,
  };
}
