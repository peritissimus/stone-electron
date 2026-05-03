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
import { getEditorMarkdown, setEditorMarkdown } from '@renderer/editor/document';
import type { RichTextEditor } from '@renderer/editor/types';
import { useEditorUI } from '@renderer/hooks/useUI';
import { logger } from '@renderer/lib/logger';

interface UseEditorModeOptions {
  editor: RichTextEditor | null;
  activeNoteId: string | null;
  isDirty: boolean;
  onSaveRaw: (markdown: string) => Promise<void>;
  onSaveRich: () => Promise<void>;
  onRawContentSaved?: (markdown: string) => void;
  onRawContentSynced?: (markdown: string, dirty: boolean) => void;
}

export function useEditorMode({
  editor,
  activeNoteId,
  isDirty,
  onSaveRaw,
  onSaveRich,
  onRawContentSaved,
  onRawContentSynced,
}: UseEditorModeOptions) {
  const { editorMode, setEditorMode } = useEditorUI();
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [rawDirty, setRawDirty] = useState(false);

  // Track previous mode and last synced content
  const previousModeRef = useRef(editorMode);
  const lastSyncedMarkdownRef = useRef('');
  const lastSavedRawMarkdownRef = useRef<string | null>(null);

  // Handle mode switching - convert content between formats
  useEffect(() => {
    if (!editor) return;

    const prevMode = previousModeRef.current;
    previousModeRef.current = editorMode;

    // Skip if mode hasn't changed
    if (prevMode === editorMode) return;

    if (editorMode === 'raw') {
      const markdown = getEditorMarkdown(editor);
      setRawMarkdown(markdown);
      lastSyncedMarkdownRef.current = markdown;
      setRawDirty(false);
      logger.info('[useEditorMode] Switched to raw mode');
    } else {
      if (rawMarkdown !== lastSyncedMarkdownRef.current) {
        setEditorMarkdown(editor, rawMarkdown);
        const rawContentDirty = rawDirty && rawMarkdown !== lastSavedRawMarkdownRef.current;
        onRawContentSynced?.(rawMarkdown, rawContentDirty);
        lastSyncedMarkdownRef.current = rawMarkdown;
        setRawDirty(false);
        logger.info('[useEditorMode] Switched to rich mode, content updated');
      } else {
        logger.info('[useEditorMode] Switched to rich mode, no changes');
      }
    }
  }, [editorMode, editor, rawMarkdown, rawDirty, onRawContentSynced]);

  // Reset to rich mode when switching notes
  const prevNoteIdRef = useRef(activeNoteId);
  useEffect(() => {
    // Only reset when note actually changes, not on every render
    if (prevNoteIdRef.current === activeNoteId) return;
    prevNoteIdRef.current = activeNoteId;

    setEditorMode('rich');
    setRawMarkdown('');
    lastSyncedMarkdownRef.current = '';
    lastSavedRawMarkdownRef.current = null;
    setRawDirty(false);
  }, [activeNoteId, setEditorMode]);

  // Handle raw markdown changes
  const handleRawMarkdownChange = useCallback((value: string) => {
    setRawMarkdown(value);
    setRawDirty(true);
  }, []);

  // Handle save - works in both modes
  const handleSave = useCallback(async () => {
    if (editorMode === 'raw' && rawDirty) {
      await onSaveRaw(rawMarkdown);
      lastSavedRawMarkdownRef.current = rawMarkdown;
      onRawContentSaved?.(rawMarkdown);
      setRawDirty(false);
      logger.info('[useEditorMode] Raw markdown saved');
    } else {
      await onSaveRich();
    }
  }, [editorMode, rawDirty, rawMarkdown, onSaveRaw, onSaveRich, onRawContentSaved]);

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
