/**
 * Note Editor Component - TipTap Rich Text Editor
 */

import { useCallback } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useAutosave } from '@renderer/hooks/useAutosave';
import { useTipTapEditor } from '@renderer/hooks/useTipTapEditor';
import { useNoteContent } from '@renderer/hooks/useNoteContent';
import {
  EditorToolbar,
  NoteEditorHeader,
  NoteEditorEmptyState,
  NoteEditorContent,
} from '@renderer/components/Editor';
import { PanelFooter } from '@renderer/components/composites';

type NoteStoreState = ReturnType<typeof useNoteStore.getState>;

export function NoteEditor() {
  const selectActiveNote = useCallback((state: NoteStoreState) => {
    if (!state.activeNoteId) return null;
    return state.notes.find((note) => note.id === state.activeNoteId) || null;
  }, []);

  const activeNote = useNoteStore(selectActiveNote);
  const activeNoteId = activeNote?.id;
  const setActiveNote = useNoteStore((state) => state.setActiveNote);
  const { updateNote, toggleFavorite, togglePin, toggleArchive, deleteNote } = useNoteAPI();

  const editor = useTipTapEditor();

  useAutosave({
    updateNote,
    activeNoteId,
    editor,
  });

  const { title, isLoading, handleTitleChange } = useNoteContent({
    activeNote,
    editor,
  });

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
      />

      {/* Editor Content */}
      <NoteEditorContent editor={editor} isLoading={isLoading} />

      <PanelFooter size="compact" justify="start">
        <EditorToolbar editor={editor} className="w-full" />
      </PanelFooter>
    </div>
  );
}
