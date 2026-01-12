/**
 * Note Editor Component - TipTap Rich Text Editor
 *
 * Implements: specs/components.ts#NoteEditorProps
 * Uses document buffer for instant note switching
 * Supports both rich text and raw markdown editing modes
 */

import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorOperations } from '@renderer/hooks/useNoteEditor';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useTipTapEditor } from '@renderer/hooks/useTipTapEditor';
import { useDocumentBuffer } from '@renderer/hooks/useDocumentBuffer';
import { useImageUpload } from '@renderer/hooks/useImageUpload';
import { useEditorMode } from '@renderer/hooks/useEditorMode';
import { useNoteExport } from '@renderer/hooks/useNoteExport';
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
  const navigate = useNavigate();
  const {
    activeNote,
    activeNoteId,
    activeNoteFilePath,
    activeWorkspace,
    syncFileTreeSelection,
    removeBuffer,
  } = useEditorOperations();

  const { updateNote, toggleFavorite, togglePin, toggleArchive, deleteNote, createNote } =
    useNoteAPI();

  const editor = useTipTapEditor();
  const creatingNoteRef = useRef(false);
  const titleSaveTimeoutRef = useRef<number | null>(null);

  // Scroll container refs for preserving scroll position on mode switch
  const richEditorScrollRef = useRef<HTMLDivElement>(null);
  const rawEditorScrollRef = useRef<HTMLDivElement>(null);
  const scrollPercentRef = useRef<number>(0);

  // Document buffer for content management
  const { isDirty, save } = useDocumentBuffer({
    noteId: activeNoteId,
    editor,
  });

  // Local title state
  const [title, setTitle] = useState('');

  // Editor mode management (rich vs raw)
  const {
    editorMode,
    rawMarkdown,
    hasUnsavedChanges,
    handleRawMarkdownChange,
    handleSave,
    handleModeToggle,
  } = useEditorMode({
    editor,
    activeNoteId,
    isDirty,
    onSaveRaw: async (markdown) => {
      if (activeNoteId) {
        await updateNote(activeNoteId, { content: markdown }, false);
      }
    },
    onSaveRich: async () => {
      await save();
    },
  });

  // Export handlers
  const { exportHtml, exportPdf, exportMarkdown } = useNoteExport({
    activeNoteId,
    editor,
    title,
  });

  // Preserve scroll position on mode switch
  const previousModeRef = useRef(editorMode);
  useEffect(() => {
    const prevMode = previousModeRef.current;
    previousModeRef.current = editorMode;

    // Skip if mode hasn't changed
    if (prevMode === editorMode) return;

    // Capture scroll position from previous editor
    const prevScrollContainer = prevMode === 'rich' ? richEditorScrollRef.current : rawEditorScrollRef.current;
    if (prevScrollContainer && prevScrollContainer.scrollHeight > prevScrollContainer.clientHeight) {
      const scrollableHeight = prevScrollContainer.scrollHeight - prevScrollContainer.clientHeight;
      scrollPercentRef.current = scrollableHeight > 0 ? prevScrollContainer.scrollTop / scrollableHeight : 0;
    }

    // Restore scroll position in new editor after a brief delay (for render)
    requestAnimationFrame(() => {
      const newScrollContainer = editorMode === 'rich' ? richEditorScrollRef.current : rawEditorScrollRef.current;
      if (newScrollContainer && newScrollContainer.scrollHeight > newScrollContainer.clientHeight) {
        const scrollableHeight = newScrollContainer.scrollHeight - newScrollContainer.clientHeight;
        newScrollContainer.scrollTop = scrollPercentRef.current * scrollableHeight;
      }
    });
  }, [editorMode]);

  // Sync title from activeNote
  useEffect(() => {
    if (activeNote?.title !== undefined) {
      setTitle(activeNote.title || '');
    }
  }, [activeNote?.title]);

  // Enable image paste/drag-drop upload
  useImageUpload({
    editor,
    noteId: activeNoteId,
    enabled: !!activeNoteId,
  });

  // Sync selectedFile with activeNote
  useEffect(() => {
    if (!activeNoteFilePath) return;
    syncFileTreeSelection(activeNoteFilePath);
  }, [activeNoteFilePath, syncFileTreeSelection]);

  // Create sibling note
  const handleCreateSiblingNote = useCallback(async () => {
    if (creatingNoteRef.current) return;
    creatingNoteRef.current = true;

    try {
      if (isDirty) await save();

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

      if (note) navigate(`/note/${note.id}`);
    } catch (error) {
      logger.error('Failed to create note via shortcut', error);
    } finally {
      creatingNoteRef.current = false;
    }
  }, [activeNoteFilePath, createNote, navigate, isDirty, save]);

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

  // Expose actions via ref
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

  // Title change with debounced save
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

  // Cleanup title save timeout
  useEffect(() => {
    return () => {
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
      }
    };
  }, []);

  // Handle note link clicks
  useEffect(() => {
    const handleNoteLinkClick = (event: Event) => {
      const { noteId } = (event as CustomEvent<{ noteId: string; title: string }>).detail;
      if (noteId && noteId !== activeNoteId) {
        logger.info('[NoteEditor] Navigating to linked note:', noteId);
        navigate(`/note/${noteId}`);
      }
    };

    document.addEventListener('note-link-click', handleNoteLinkClick);
    return () => document.removeEventListener('note-link-click', handleNoteLinkClick);
  }, [activeNoteId, navigate]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!activeNote) return;

    const confirmed = window.confirm('Are you sure you want to delete this note?');
    if (confirmed) {
      try {
        const success = await deleteNote(activeNote.id, true);
        if (success) {
          removeBuffer(activeNote.id);
          navigate('/home');
          logger.info('[NoteEditor] Note deleted successfully');
        }
      } catch (error) {
        logger.error('[NoteEditor] Error deleting note:', error);
      }
    }
  }, [activeNote, deleteNote, removeBuffer, navigate]);

  // Toggle handlers
  const handleToggleFavorite = useCallback(() => {
    if (activeNote) toggleFavorite(activeNote.id);
  }, [activeNote, toggleFavorite]);

  const handleTogglePin = useCallback(() => {
    if (activeNote) togglePin(activeNote.id);
  }, [activeNote, togglePin]);

  const handleToggleArchive = useCallback(() => {
    if (activeNote) {
      toggleArchive(activeNote.id);
      navigate('/home');
    }
  }, [activeNote, toggleArchive, navigate]);

  if (!activeNote) {
    return <NoteEditorEmptyState onCreateNote={handleCreateSiblingNote} />;
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
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
        showSave={hasUnsavedChanges}
        onSave={handleSave}
        onModeToggle={handleModeToggle}
        onExportHtml={exportHtml}
        onExportPdf={exportPdf}
        onExportMarkdown={exportMarkdown}
      />

      {editorMode === 'raw' ? (
        <RawMarkdownEditor ref={rawEditorScrollRef} value={rawMarkdown} onChange={handleRawMarkdownChange} />
      ) : (
        <NoteEditorContent ref={richEditorScrollRef} editor={editor} isLoading={false} />
      )}

      {activeNoteId && editorMode === 'rich' && <BacklinksPanel noteId={activeNoteId} />}

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
