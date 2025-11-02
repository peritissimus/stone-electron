/**
 * Note Editor Component - TipTap Rich Text Editor
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { EditorToolbar } from '@renderer/components/Editor';
import { EditorContent } from '@tiptap/react';
import {
  Star,
  PushPin,
  Archive,
  DotsThreeVertical,
  Article,
  Plus,
  Trash,
  Check,
  Spinner,
} from 'phosphor-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import { ContainerFlex } from '@renderer/components/ui';
import { Header, IconButton, PanelFooter } from '@renderer/components/composites';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';

type NoteStoreState = ReturnType<typeof useNoteStore.getState>;

export function NoteEditor() {
  const selectActiveNote = useCallback((state: NoteStoreState) => {
    if (!state.activeNoteId) return null;
    return state.notes.find((note) => note.id === state.activeNoteId) || null;
  }, []);
  const activeNote = useNoteStore(selectActiveNote);
  const activeNoteId = activeNote?.id;
  const activeNoteIdRef = useRef<string | null>(activeNoteId ?? null);
  const setActiveNote = useNoteStore((state) => state.setActiveNote);
  const { updateNote, toggleFavorite, togglePin, toggleArchive, deleteNote } = useNoteAPI();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const saveTimeoutRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId ?? null;
  }, [activeNoteId]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-lg' },
      }),
      Highlight.configure({
        HTMLAttributes: { class: 'bg-accent' },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px]',
      },
    },
    onUpdate: ({ editor }) => {
      const noteId = activeNoteIdRef.current;
      if (!noteId) return;

      // Debounce save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      const timeout = window.setTimeout(async () => {
        saveTimeoutRef.current = null;
        isSavingRef.current = true;
        try {
          // Use silent=true to save without triggering store update/re-render
          const result = await updateNote(noteId, { content: editor.getHTML() }, true);
          if (!result) {
            console.error('Autosave failed: updateNote returned falsy result');
          }
        } catch (error) {
          console.error('Autosave failed:', error);
        } finally {
          isSavingRef.current = false;
        }
      }, 1000);

      saveTimeoutRef.current = timeout;
    },
  });

  // Load content when active note changes
  useEffect(() => {
    if (!activeNote || !editor) return;

    const loadContent = async () => {
      setIsLoading(true);
      setTitle(activeNote.title || '');

      try {
        // Load content from file
        const response = await window.electron.invoke<{ content: string }>(
          NOTE_CHANNELS.GET_CONTENT,
          { id: activeNote.id },
        );

        if (response.success && response.data) {
          const loadedContent = response.data.content;
          setContent(loadedContent);
          editor.commands.setContent(loadedContent);
        }
      } catch (error) {
        console.error('Failed to load note content:', error);
        setContent('');
        editor.commands.setContent('');
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [activeNote?.id, editor]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Autosave on window blur
  useEffect(() => {
    const handleWindowBlur = () => {
      const noteId = activeNoteIdRef.current;
      if (noteId && editor && saveTimeoutRef.current) {
        // Clear pending timeout and save immediately
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        isSavingRef.current = true;
        // Use silent=true to save without triggering store update/re-render
        updateNote(noteId, { content: editor.getHTML() }, true)
          .then((result) => {
            if (!result) {
              console.error('Blur autosave failed: updateNote returned falsy result');
            }
          })
          .catch((error) => {
            console.error('Blur autosave failed:', error);
          })
          .finally(() => {
            isSavingRef.current = false;
          });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSavingRef.current || saveTimeoutRef.current) {
        // Show confirmation dialog if save is in progress
        e.preventDefault();
        e.returnValue = 'Changes are being saved. Are you sure you want to leave?';
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editor, updateNote]);

  // Handle title change
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      if (!activeNoteId) return;

      // Clear any pending content save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Save title immediately (shorter debounce for titles)
      const noteId = activeNoteId;
      const timeout = window.setTimeout(async () => {
        saveTimeoutRef.current = null;
        isSavingRef.current = true;
        try {
          // Use silent=true to save without triggering store update/re-render
          const result = await updateNote(noteId, { title: newTitle }, true);
          if (!result) {
            console.error('Title autosave failed: updateNote returned falsy result');
          }
        } catch (error) {
          console.error('Title autosave failed:', error);
        } finally {
          isSavingRef.current = false;
        }
      }, 500);
      saveTimeoutRef.current = timeout;
    },
    [activeNoteId, updateNote],
  );

  if (!activeNote) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center px-8 py-16">
        <div className="text-center max-w-md">
          {/* Icon Circle */}
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center">
              <Article size={36} className="text-primary" />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-semibold mb-3 text-foreground">No note selected</h2>

          {/* Description */}
          <p className="text-muted-foreground mb-8 leading-relaxed text-base">
            Select a note from the sidebar to view and edit it, or create a new one to get started
            with your writing.
          </p>

          {/* CTA Button */}
          <Button
            onClick={() => {
              const noteListButton = document.querySelector(
                '[title="Create a new note"]',
              ) as HTMLButtonElement;
              noteListButton?.click();
            }}
            className="h-10 px-6 text-sm font-medium"
            size="lg"
          >
            <Plus size={16} className="mr-2" />
            Create your first note
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0">
      {/* Editor Header */}
      <Header
        divided
        size="roomy"
        left={
          <div className="flex-1 min-w-0 flex items-center">
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Note"
              className="w-full h-10 px-0 border-0 bg-transparent text-2xl font-semibold leading-tight text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        }
        right={
          <ContainerFlex align="center" gap="none">
            <div className="flex items-center justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    size="normal"
                    icon={<DotsThreeVertical size={16} />}
                    tooltip="More Options"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toggleFavorite(activeNote.id)}>
                    <Star
                      size={14}
                      className="mr-2"
                      weight={activeNote.isFavorite ? 'fill' : 'regular'}
                    />
                    {activeNote.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                    {activeNote.isFavorite && <Check size={14} className="ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => togglePin(activeNote.id)}>
                    <PushPin
                      size={14}
                      className="mr-2"
                      weight={activeNote.isPinned ? 'fill' : 'regular'}
                    />
                    {activeNote.isPinned ? 'Unpin Note' : 'Pin Note'}
                    {activeNote.isPinned && <Check size={14} className="ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      toggleArchive(activeNote.id);
                      setActiveNote(null);
                    }}
                  >
                    <Archive
                      size={14}
                      className="mr-2"
                      weight={activeNote.isArchived ? 'fill' : 'regular'}
                    />
                    {activeNote.isArchived ? 'Unarchive Note' : 'Archive Note'}
                    {activeNote.isArchived && <Check size={14} className="ml-auto text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this note?')) {
                        deleteNote(activeNote.id, true);
                      }
                    }}
                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                  >
                    <Trash size={14} className="mr-2" />
                    Delete Note
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContainerFlex>
        }
      />

      {/* Editor Content */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-background relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-card border shadow-sm">
              <Spinner size={16} className="animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Loading note...</span>
            </div>
          </div>
        )}
        <div className="max-w-4xl mx-auto px-8 py-8">
          <div className="min-h-[600px]">
            <EditorContent
              editor={editor}
              className="prose prose-lg dark:prose-invert max-w-none focus-within:outline-none"
            />
          </div>
        </div>
      </div>

      <PanelFooter size="compact" justify="start">
        <EditorToolbar editor={editor} className="w-full" />
      </PanelFooter>
    </div>
  );
}
