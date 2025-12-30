/**
 * Note Editor Component - TipTap Rich Text Editor
 */

import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useWorkspaceStore } from '@renderer/stores/workspaceStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useTipTapEditor } from '@renderer/hooks/useTipTapEditor';
import { useNoteContent } from '@renderer/hooks/useNoteContent';
import { useImageUpload } from '@renderer/hooks/useImageUpload';
import {
  NoteEditorHeader,
  NoteEditorEmptyState,
  NoteEditorContent,
  EditorStats,
  BacklinksPanel,
} from '@renderer/components/features/Editor';
import { Copy, Check } from 'phosphor-react';
import { jsonToMarkdown } from '@renderer/utils/jsonToMarkdown';
import { logger } from '@renderer/utils/logger';
import { getRenderedEditorContent, buildExportHTML } from '@renderer/utils/exportUtils';
import { saveDraft, deleteDraft } from '@renderer/utils/draftStorage';
import { normalizePath } from '@renderer/utils/path';
import { fastDeepEqual } from '@renderer/utils/fastEquals';

/**
 * NoteEditor ref API - exposed actions for keyboard shortcuts
 */
export interface NoteEditorHandle {
  save: () => Promise<void>;
  createSiblingNote: () => Promise<void>;
  restoreDraft: (content: string) => void;
}

type NoteStoreState = ReturnType<typeof useNoteStore.getState>;

export const NoteEditor = forwardRef<NoteEditorHandle>((_, ref) => {
  const selectActiveNote = useCallback((state: NoteStoreState) => {
    if (!state.activeNoteId) {
      logger.debug('[NoteEditor] selectActiveNote: no activeNoteId');
      return null;
    }
    const found = state.notes.find((note) => note.id === state.activeNoteId) || null;
    logger.debug('[NoteEditor] selectActiveNote', {
      activeNoteId: state.activeNoteId,
      found: !!found,
      notesCount: state.notes.length,
      noteIds: state.notes.slice(0, 5).map(n => n.id) // First 5 note IDs for debugging
    });
    return found;
  }, []);

  const activeNote = useNoteStore(selectActiveNote);
  const activeNoteId = activeNote?.id;
  const activeNoteFilePath = activeNote?.filePath ? activeNote.filePath.replace(/\\/g, '/') : '';
  const setActiveNote = useNoteStore((state) => state.setActiveNote);
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const { updateNote, toggleFavorite, togglePin, toggleArchive, deleteNote, createNote, exportHtml, exportPdf, exportMarkdown } =
    useNoteAPI();

  const editor = useTipTapEditor();
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedJsonRef = useRef<any | null>(null);
  const creatingNoteRef = useRef(false);

  const { title, content, isLoading, handleTitleChange } = useNoteContent({
    activeNote,
    editor,
  });

  // Enable image paste/drag-drop upload
  useImageUpload({
    editor,
    noteId: activeNoteId || null,
    enabled: !!activeNoteId,
  });

  // Sync selectedFile with activeNote to highlight the file in the tree
  useEffect(() => {
    if (!activeNoteFilePath) {
      logger.info('[NoteEditor] No active note file path, skipping sync');
      return;
    }

    logger.info('[NoteEditor] Syncing selectedFile with activeNote', {
      activeNoteId,
      activeNoteFilePath,
    });

    const { setSelectedFile, setActiveFolder } = useFileTreeStore.getState();
    const normalizedPath = normalizePath(activeNoteFilePath);

    logger.info('[NoteEditor] Setting selectedFile in FileTree', {
      originalPath: activeNoteFilePath,
      normalizedPath,
    });

    // Set the selected file to highlight it in the tree
    setSelectedFile(normalizedPath);

    // Also set the active folder
    const lastSlash = normalizedPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const folderPath = normalizedPath.substring(0, lastSlash);
      logger.info('[NoteEditor] Setting active folder', { folderPath });
      setActiveFolder(folderPath);
    }
  }, [activeNoteFilePath, activeNoteId]);

  // After content loads into the editor, set baseline for dirty tracking
  useEffect(() => {
    if (!editor) return;
    // Defer until editor processed content
    const timeout = window.setTimeout(() => {
      try {
        lastSavedJsonRef.current = editor.getJSON();
        setIsDirty(false);
      } catch {}
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeNoteId, content, editor]);

  // Listen for editor updates to toggle dirty state (debounced for performance)
  // Also autosave to localStorage for crash recovery
  useEffect(() => {
    if (!editor || !activeNoteId) return;

    let timeoutId: NodeJS.Timeout | null = null;
    let autosaveTimeoutId: NodeJS.Timeout | null = null;

    const handler = () => {
      // Immediately set dirty to true for instant visual feedback
      setIsDirty(true);

      // Debounce the actual comparison check (expensive operation)
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        try {
          const current = editor.getJSON();
          const baseline = lastSavedJsonRef.current;
          // Use fast deep equality instead of JSON.stringify (much faster)
          const equal = fastDeepEqual(current, baseline);
          setIsDirty(!equal);
        } catch {
          setIsDirty(true);
        }
      }, 500); // Check after 500ms of inactivity

      // Autosave to localStorage for crash recovery (longer debounce)
      if (autosaveTimeoutId) {
        clearTimeout(autosaveTimeoutId);
      }

      autosaveTimeoutId = setTimeout(() => {
        try {
          const current = editor.getJSON();
          const contentJson = JSON.stringify(current);
          saveDraft(activeNoteId, contentJson, title);
          logger.info('[NoteEditor] Draft autosaved to localStorage');
        } catch (error) {
          logger.error('[NoteEditor] Failed to autosave draft:', error);
        }
      }, 2000); // Autosave after 2 seconds of inactivity
    };

    editor.on('update', handler);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (autosaveTimeoutId) {
        clearTimeout(autosaveTimeoutId);
      }
      editor.off('update', handler);
    };
  }, [editor, activeNoteId, title]);

  const handleSave = useCallback(async () => {
    if (!editor || !activeNoteId) return;
    const json = editor.getJSON();
    const markdown = jsonToMarkdown(json as any);
    const result = await updateNote(activeNoteId, { content: markdown }, false);
    if (result) {
      lastSavedJsonRef.current = json;
      setIsDirty(false);
      // Delete draft from localStorage after successful save
      deleteDraft(activeNoteId);
      logger.info('[NoteEditor] Draft deleted after successful save');
    }
  }, [editor, activeNoteId, updateNote]);

  const handleCreateSiblingNote = useCallback(async () => {
    if (creatingNoteRef.current) return;
    creatingNoteRef.current = true;

    try {
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
        if (editor) {
          editor.commands.clearContent(true);
        }
        setActiveNote(note.id);
        lastSavedJsonRef.current = null;
        setIsDirty(false);
      }
    } catch (error) {
      logger.error('Failed to create note via shortcut', error);
    } finally {
      creatingNoteRef.current = false;
    }
  }, [activeNoteFilePath, createNote, editor, setActiveNote]);

  const handleRestoreDraft = useCallback((content: string) => {
    if (!editor) return;
    try {
      const contentJson = JSON.parse(content);
      editor.commands.setContent(contentJson);
      setIsDirty(true);
      logger.info('[NoteEditor] Draft content restored');
    } catch (error) {
      logger.error('[NoteEditor] Failed to restore draft:', error);
    }
  }, [editor]);

  // Expose actions via ref for keyboard shortcuts
  useImperativeHandle(
    ref,
    () => ({
      save: handleSave,
      createSiblingNote: handleCreateSiblingNote,
      restoreDraft: handleRestoreDraft,
    }),
    [handleSave, handleCreateSiblingNote, handleRestoreDraft],
  );

  const handleTitleChangeWithSave = useCallback(
    async (newTitle: string) => {
      await handleTitleChange(newTitle, async (title: string) => {
        if (!activeNoteId) return;
        // Immediate title save (shorter debounce)
        // Use silent: false so store updates reflect any failures
        setTimeout(async () => {
          try {
            await updateNote(activeNoteId, { title }, false);
          } catch (error) {
            logger.error('Title autosave failed:', error);
          }
        }, 500);
      });
    },
    [handleTitleChange, activeNoteId, updateNote],
  );

  // Handle note link clicks to navigate to linked notes
  useEffect(() => {
    const handleNoteLinkClick = (event: CustomEvent<{ noteId: string; title: string }>) => {
      const { noteId } = event.detail;
      if (noteId && noteId !== activeNoteId) {
        logger.info('[NoteEditor] Navigating to linked note:', noteId);
        setActiveNote(noteId);
      }
    };

    // Add event listener
    document.addEventListener('note-link-click', handleNoteLinkClick as EventListener);

    return () => {
      document.removeEventListener('note-link-click', handleNoteLinkClick as EventListener);
    };
  }, [activeNoteId, setActiveNote]);

  if (!activeNote) {
    return <NoteEditorEmptyState />;
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Editor Header */}
      <NoteEditorHeader
        title={title}
        onTitleChange={handleTitleChangeWithSave}
        isFavorite={activeNote.isFavorite || false}
        isPinned={activeNote.isPinned || false}
        isArchived={activeNote.isArchived || false}
        onToggleFavorite={() => toggleFavorite(activeNote.id)}
        onTogglePin={() => togglePin(activeNote.id)}
        onToggleArchive={() => {
          toggleArchive(activeNote.id);
          setActiveNote(null);
        }}
        onDelete={async () => {
          logger.info('[NoteEditor] Delete clicked for note:', activeNote.id);
          const confirmed = window.confirm('Are you sure you want to delete this note?');
          logger.info('[NoteEditor] Confirm result:', confirmed);
          if (confirmed) {
            try {
              logger.info('[NoteEditor] Calling deleteNote...');
              const success = await deleteNote(activeNote.id, true);
              logger.info('[NoteEditor] deleteNote result:', success);
              if (success) {
                setActiveNote(null);
                deleteDraft(activeNote.id);
                logger.info('[NoteEditor] Note deleted successfully');
              } else {
                logger.error('[NoteEditor] Failed to delete note - returned false');
              }
            } catch (error) {
              logger.error('[NoteEditor] Error deleting note:', error);
            }
          }
        }}
        showSave={isDirty}
        onSave={handleSave}
        onExportHtml={async () => {
          if (!activeNote || !editor) return;
          const htmlContent = editor.getHTML();
          await exportHtml(activeNote.id, htmlContent, title);
        }}
        onExportPdf={async () => {
          if (!activeNote || !editor) return;
          // Get pre-rendered content from DOM (includes Mermaid SVGs, syntax highlighting)
          const renderedContent = getRenderedEditorContent(editor);
          // Build complete HTML with app's CSS
          const fullHtml = buildExportHTML(title, renderedContent);
          await exportPdf(activeNote.id, fullHtml, title);
        }}
        onExportMarkdown={async () => {
          if (!activeNote) return;
          await exportMarkdown(activeNote.id, title);
        }}
      />

      {/* Editor Content */}
      <NoteEditorContent editor={editor} isLoading={isLoading} />

      {/* Backlinks Panel */}
      {activeNoteId && <BacklinksPanel noteId={activeNoteId} />}

      {/* Minimal Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-border text-xs text-muted-foreground shrink-0">
        <EditorStats editor={editor} />
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

  // Build full absolute path
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
      {copied ? (
        <Check size={12} className="text-success" />
      ) : (
        <Copy size={12} />
      )}
      <span className="max-w-[200px] truncate">{filePath}</span>
    </button>
  );
}

NoteEditor.displayName = 'NoteEditor';
