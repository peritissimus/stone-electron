/**
 * Note Editor Component - TipTap Rich Text Editor
 *
 * Implements: specs/components.ts#NoteEditorProps
 * Uses document buffer for instant note switching
 * Supports both rich text and raw markdown editing modes
 */

import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { marked } from 'marked';
import { useEditorOperations } from '@renderer/hooks/useNoteEditor';
import { useEditorUI } from '@renderer/hooks/useUI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useTipTapEditor } from '@renderer/hooks/useTipTapEditor';
import { useDocumentBuffer } from '@renderer/hooks/useDocumentBuffer';
import { useImageUpload } from '@renderer/hooks/useImageUpload';
import {
  NoteEditorHeader,
  NoteEditorEmptyState,
  NoteEditorContent,
  RawMarkdownEditor,
  EditorStats,
  BacklinksPanel,
} from '@renderer/components/features/Editor';
import { Copy, Check } from 'phosphor-react';
import { logger } from '@renderer/utils/logger';
import { getRenderedEditorContent, buildExportHTML } from '@renderer/utils/exportUtils';
import { jsonToMarkdown } from '@renderer/utils/jsonToMarkdown';

import type { Editor } from '@tiptap/react';

/**
 * NoteEditor ref API - exposed actions for keyboard shortcuts
 */
export interface NoteEditorHandle {
  save: () => Promise<void>;
  createSiblingNote: () => Promise<void>;
  restoreDraft: (content: string) => void;
  getEditor: () => Editor | null;
}

export const NoteEditor = forwardRef<NoteEditorHandle>((_, ref) => {
  // Use centralized editor operations hook
  const {
    activeNote,
    activeNoteId,
    activeNoteFilePath,
    activeWorkspace,
    setActiveNote,
    syncFileTreeSelection,
    removeBuffer,
  } = useEditorOperations();

  const {
    updateNote,
    toggleFavorite,
    togglePin,
    toggleArchive,
    deleteNote,
    createNote,
    exportHtml,
    exportPdf,
    exportMarkdown,
  } = useNoteAPI();

  const editor = useTipTapEditor();
  const creatingNoteRef = useRef(false);
  const titleSaveTimeoutRef = useRef<number | null>(null);

  // Editor mode (rich vs raw)
  const { editorMode, setEditorMode } = useEditorUI();
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [rawDirty, setRawDirty] = useState(false);
  const previousModeRef = useRef(editorMode);

  // Use document buffer for content management
  const { isDirty, save } = useDocumentBuffer({
    noteId: activeNoteId,
    editor,
  });

  // Local title state (synced from activeNote)
  const [title, setTitle] = useState('');

  // Sync title from activeNote
  useEffect(() => {
    if (activeNote?.title !== undefined) {
      setTitle(activeNote.title || '');
    }
  }, [activeNote?.title]);

  // Track the last synced markdown to detect if we need to update the editor
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
      logger.info('[NoteEditor] Switched to raw mode');
    } else {
      // Raw → Rich: Convert markdown to HTML and update editor
      // Always update if content differs from last synced version
      if (rawMarkdown !== lastSyncedMarkdownRef.current) {
        // Configure marked for GFM
        marked.setOptions({
          gfm: true,
          breaks: true,
        });

        const html = marked.parse(rawMarkdown) as string;
        editor.commands.setContent(html);
        lastSyncedMarkdownRef.current = rawMarkdown;
        setRawDirty(false);
        logger.info('[NoteEditor] Switched to rich mode, content updated');
      } else {
        logger.info('[NoteEditor] Switched to rich mode, no changes');
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

  // Enable image paste/drag-drop upload
  useImageUpload({
    editor,
    noteId: activeNoteId,
    enabled: !!activeNoteId,
  });

  // Sync selectedFile with activeNote to highlight the file in the tree
  useEffect(() => {
    if (!activeNoteFilePath) return;
    syncFileTreeSelection(activeNoteFilePath);
  }, [activeNoteFilePath, syncFileTreeSelection]);

  // Handle save - works in both rich and raw modes
  const handleSave = useCallback(async () => {
    if (editorMode === 'raw' && rawDirty && activeNoteId) {
      // In raw mode, save markdown directly
      try {
        await updateNote(activeNoteId, { content: rawMarkdown }, false);
        setRawDirty(false);
        logger.info('[NoteEditor] Raw markdown saved');
      } catch (error) {
        logger.error('[NoteEditor] Failed to save raw markdown:', error);
      }
    } else {
      // In rich mode, use the document buffer save
      await save();
    }
  }, [editorMode, rawDirty, rawMarkdown, activeNoteId, updateNote, save]);

  // Handle mode toggle - auto-save before switching
  const handleModeToggle = useCallback(async () => {
    const hasUnsavedChanges = editorMode === 'raw' ? rawDirty : isDirty;
    if (hasUnsavedChanges) {
      // Auto-save before switching modes
      await handleSave();
      logger.info('[NoteEditor] Auto-saved before mode toggle');
    }
    return true;
  }, [editorMode, rawDirty, isDirty, handleSave]);

  // Create sibling note
  const handleCreateSiblingNote = useCallback(async () => {
    if (creatingNoteRef.current) return;
    creatingNoteRef.current = true;

    try {
      // Save current note first
      if (isDirty) {
        await save();
      }

      const now = new Date();
      const defaultTitle = `Untitled Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      const folderRelative = activeNoteFilePath.includes('/')
        ? activeNoteFilePath.slice(0, activeNoteFilePath.lastIndexOf('/'))
        : '';

      const note = await createNote({
        title: defaultTitle,
        content: '',
        folderPath: folderRelative || undefined,
      });

      if (note) {
        setActiveNote(note.id);
      }
    } catch (error) {
      logger.error('Failed to create note via shortcut', error);
    } finally {
      creatingNoteRef.current = false;
    }
  }, [activeNoteFilePath, createNote, setActiveNote, isDirty, save]);

  // Restore draft content
  const handleRestoreDraft = useCallback(
    (content: string) => {
      if (!editor) return;
      try {
        const contentJson = JSON.parse(content);
        editor.commands.setContent(contentJson);
        logger.info('[NoteEditor] Draft content restored');
      } catch (error) {
        logger.error('[NoteEditor] Failed to restore draft:', error);
      }
    },
    [editor],
  );

  // Expose actions via ref for keyboard shortcuts
  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      createSiblingNote: handleCreateSiblingNote,
      restoreDraft: handleRestoreDraft,
      getEditor: () => editor,
    }),
    [handleSave, handleCreateSiblingNote, handleRestoreDraft, editor],
  );

  // Handle title change with debounced save
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);

      if (!activeNoteId) return;

      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }

      titleSaveTimeoutRef.current = window.setTimeout(async () => {
        titleSaveTimeoutRef.current = null;
        try {
          await updateNote(activeNoteId, { title: newTitle }, false);
        } catch (error) {
          logger.error('Title autosave failed:', error);
        }
      }, 500);
    },
    [activeNoteId, updateNote],
  );

  // Cleanup title save timeout on unmount
  useEffect(() => {
    return () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }
    };
  }, []);

  // Handle note link clicks to navigate to linked notes
  useEffect(() => {
    const handleNoteLinkClick = (event: Event) => {
      const { noteId } = (event as CustomEvent<{ noteId: string; title: string }>).detail;
      if (noteId && noteId !== activeNoteId) {
        logger.info('[NoteEditor] Navigating to linked note:', noteId);
        setActiveNote(noteId);
      }
    };

    document.addEventListener('note-link-click', handleNoteLinkClick);
    return () => {
      document.removeEventListener('note-link-click', handleNoteLinkClick);
    };
  }, [activeNoteId, setActiveNote]);

  // Handle delete - remove buffer when note is deleted
  const handleDelete = useCallback(async () => {
    if (!activeNote) return;

    logger.info('[NoteEditor] Delete clicked for note:', activeNote.id);
    const confirmed = window.confirm('Are you sure you want to delete this note?');

    if (confirmed) {
      try {
        const success = await deleteNote(activeNote.id, true);
        if (success) {
          removeBuffer(activeNote.id);
          setActiveNote(null);
          logger.info('[NoteEditor] Note deleted successfully');
        }
      } catch (error) {
        logger.error('[NoteEditor] Error deleting note:', error);
      }
    }
  }, [activeNote, deleteNote, removeBuffer, setActiveNote]);

  // Memoized toggle handlers to prevent re-renders
  const handleToggleFavorite = useCallback(() => {
    if (activeNote) toggleFavorite(activeNote.id);
  }, [activeNote, toggleFavorite]);

  const handleTogglePin = useCallback(() => {
    if (activeNote) togglePin(activeNote.id);
  }, [activeNote, togglePin]);

  const handleToggleArchive = useCallback(() => {
    if (activeNote) {
      toggleArchive(activeNote.id);
      setActiveNote(null);
    }
  }, [activeNote, toggleArchive, setActiveNote]);

  // Memoized export handlers
  const handleExportHtml = useCallback(async () => {
    if (!activeNote || !editor) return;
    const htmlContent = editor.getHTML();
    await exportHtml(activeNote.id, htmlContent, title);
  }, [activeNote, editor, exportHtml, title]);

  const handleExportPdf = useCallback(async () => {
    if (!activeNote || !editor) return;
    const renderedContent = getRenderedEditorContent(editor);
    const fullHtml = buildExportHTML(title, renderedContent);
    await exportPdf(activeNote.id, fullHtml, title);
  }, [activeNote, editor, exportPdf, title]);

  const handleExportMarkdown = useCallback(async () => {
    if (!activeNote) return;
    await exportMarkdown(activeNote.id, title);
  }, [activeNote, exportMarkdown, title]);

  if (!activeNote) {
    return <NoteEditorEmptyState onCreateNote={handleCreateSiblingNote} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Editor Header */}
      <NoteEditorHeader
        title={title}
        onTitleChange={handleTitleChange}
        isFavorite={activeNote.isFavorite || false}
        isPinned={activeNote.isPinned || false}
        isArchived={activeNote.isArchived || false}
        onToggleFavorite={handleToggleFavorite}
        onTogglePin={handleTogglePin}
        onToggleArchive={handleToggleArchive}
        onDelete={handleDelete}
        showSave={editorMode === 'raw' ? rawDirty : isDirty}
        onSave={handleSave}
        onModeToggle={handleModeToggle}
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
        onExportMarkdown={handleExportMarkdown}
      />

      {/* Editor Content - Rich or Raw mode */}
      {editorMode === 'raw' ? (
        <RawMarkdownEditor value={rawMarkdown} onChange={handleRawMarkdownChange} />
      ) : (
        <NoteEditorContent editor={editor} isLoading={false} />
      )}

      {/* Backlinks Panel - only in rich mode */}
      {activeNoteId && editorMode === 'rich' && <BacklinksPanel noteId={activeNoteId} />}

      {/* Minimal Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border text-xs text-muted-foreground shrink-0">
        {editorMode === 'raw' ? (
          <RawEditorStats markdown={rawMarkdown} />
        ) : (
          <EditorStats editor={editor} />
        )}
        {activeNote?.filePath && activeWorkspace?.folderPath && (
          <CopyPathButton
            filePath={activeNote.filePath}
            workspacePath={activeWorkspace.folderPath}
          />
        )}
      </div>
    </div>
  );
});

function CopyPathButton({ filePath, workspacePath }: { filePath: string; workspacePath: string }) {
  const [copied, setCopied] = useState(false);
  const fullPath = `${workspacePath}/${filePath}`.replace(/\/+/g, '/');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy path:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent/20 transition-colors"
      title={copied ? 'Copied!' : `Copy path: ${fullPath}`}
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      <span className="max-w-[200px] truncate">{filePath}</span>
    </button>
  );
}

function RawEditorStats({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n').length;
  const chars = markdown.length;
  const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;

  return (
    <div className="flex items-center gap-3">
      <span>{words} words</span>
      <span>{chars} characters</span>
      <span>{lines} lines</span>
      <span className="text-muted-foreground/60">Markdown</span>
    </div>
  );
}

NoteEditor.displayName = 'NoteEditor';
