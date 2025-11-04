/**
 * Note Editor Component - TipTap Rich Text Editor
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useTipTapEditor } from '@renderer/hooks/useTipTapEditor';
import { useNoteContent } from '@renderer/hooks/useNoteContent';
import {
  EditorToolbar,
  NoteEditorHeader,
  NoteEditorEmptyState,
  NoteEditorContent,
} from '@renderer/components/features/Editor';
import { PanelFooter } from '@renderer/components/composites';
import { jsonToMarkdown } from '@renderer/utils/jsonToMarkdown';
import { logger } from '@renderer/utils/logger';

type NoteStoreState = ReturnType<typeof useNoteStore.getState>;

export function NoteEditor() {
  const selectActiveNote = useCallback((state: NoteStoreState) => {
    if (!state.activeNoteId) return null;
    return state.notes.find((note) => note.id === state.activeNoteId) || null;
  }, []);

  const activeNote = useNoteStore(selectActiveNote);
  const activeNoteId = activeNote?.id;
  const activeNoteFilePath = activeNote?.filePath ? activeNote.filePath.replace(/\\/g, '/') : '';
  const setActiveNote = useNoteStore((state) => state.setActiveNote);
  const { updateNote, toggleFavorite, togglePin, toggleArchive, deleteNote, createNote } =
    useNoteAPI();

  const editor = useTipTapEditor();
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedJsonRef = useRef<any | null>(null);
  const creatingNoteRef = useRef(false);

  const { title, content, isLoading, handleTitleChange } = useNoteContent({
    activeNote,
    editor,
  });

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

  // Listen for editor updates to toggle dirty state
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      try {
        const current = editor.getJSON();
        const baseline = lastSavedJsonRef.current;
        const equal = JSON.stringify(current) === JSON.stringify(baseline);
        setIsDirty(!equal);
      } catch {
        setIsDirty(true);
      }
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor]);

  const handleSave = useCallback(async () => {
    if (!editor || !activeNoteId) return;
    const json = editor.getJSON();
    const markdown = jsonToMarkdown(json as any);
    const result = await updateNote(activeNoteId, { content: markdown }, false);
    if (result) {
      lastSavedJsonRef.current = json;
      setIsDirty(false);
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

  const handleTitleChangeWithSave = useCallback(
    async (newTitle: string) => {
      await handleTitleChange(newTitle, async (title: string) => {
        if (!activeNoteId) return;
        // Immediate title save (shorter debounce)
        setTimeout(async () => {
          try {
            await updateNote(activeNoteId, { title }, true);
          } catch (error) {
            console.error('Title autosave failed:', error);
          }
        }, 500);
      });
    },
    [handleTitleChange, activeNoteId, updateNote],
  );

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
        onDelete={() => {
          if (window.confirm('Are you sure you want to delete this note?')) {
            deleteNote(activeNote.id, true);
          }
        }}
        showSave={isDirty}
        onSave={handleSave}
      />

      {/* Editor Content */}
      <NoteEditorContent editor={editor} isLoading={isLoading} />

      <PanelFooter size="compact" justify="start">
        <EditorToolbar editor={editor} className="w-full" />
      </PanelFooter>
    </div>
  );
}
