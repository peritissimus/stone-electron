/**
 * Note Editor Component - TipTap Rich Text Editor
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Warning,
  Spinner,
} from 'phosphor-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import { Text, Body } from '@renderer/components/ui/text';
import { ContainerFlex, ContainerCenter } from '@renderer/components/ui';
import { Header, IconButton } from '@renderer/components/composites';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function NoteEditor() {
  const { getActiveNote, setActiveNote } = useNoteStore();
  const { updateNote, toggleFavorite, togglePin, toggleArchive, deleteNote, loadNoteById } =
    useNoteAPI();
  const activeNote = getActiveNote();

  const [title, setTitle] = useState('');
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    content: activeNote?.content || '',
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px]',
      },
    },
    onUpdate: ({ editor }) => {
      if (!activeNote) return;

      // Set status to indicate changes are pending
      setAutosaveStatus('idle');

      // Debounce save
      if (saveTimeout) clearTimeout(saveTimeout);
      const timeout = setTimeout(async () => {
        setAutosaveStatus('saving');
        try {
          const result = await updateNote(activeNote.id, { content: editor.getHTML() });
          if (result) {
            setAutosaveStatus('saved');
            setLastSaved(new Date());
            // Reset to idle after showing saved status
            setTimeout(() => setAutosaveStatus('idle'), 2000);
          } else {
            setAutosaveStatus('error');
          }
        } catch (error) {
          console.error('Autosave failed:', error);
          setAutosaveStatus('error');
          // Reset error status after 3 seconds
          setTimeout(() => setAutosaveStatus('idle'), 3000);
        }
      }, 1000);
      setSaveTimeout(timeout);
    },
  });

  // Update editor when active note changes
  useEffect(() => {
    if (activeNote && editor) {
      setTitle(activeNote.title || '');
      setAutosaveStatus('idle');
      setLastSaved(null);
      if (activeNote.content !== undefined && activeNote.content !== editor.getHTML()) {
        editor.commands.setContent(activeNote.content);
      }
    }
  }, [activeNote?.id, activeNote?.content, editor]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  useEffect(() => {
    if (
      activeNote &&
      activeNote.filePath &&
      (activeNote.content === null || activeNote.content === undefined)
    ) {
      setIsLoading(true);
      loadNoteById(activeNote.id).finally(() => {
        setIsLoading(false);
      });
    }
  }, [activeNote?.id, activeNote?.content, activeNote?.filePath, loadNoteById]);

  // Autosave on window blur
  useEffect(() => {
    const handleWindowBlur = () => {
      if (activeNote && editor && saveTimeout) {
        // Clear pending timeout and save immediately
        clearTimeout(saveTimeout);
        setSaveTimeout(null);
        setAutosaveStatus('saving');
        updateNote(activeNote.id, { content: editor.getHTML() })
          .then((result) => {
            if (result) {
              setAutosaveStatus('saved');
              setLastSaved(new Date());
              setTimeout(() => setAutosaveStatus('idle'), 2000);
            } else {
              setAutosaveStatus('error');
            }
          })
          .catch((error) => {
            console.error('Blur autosave failed:', error);
            setAutosaveStatus('error');
            setTimeout(() => setAutosaveStatus('idle'), 3000);
          });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autosaveStatus === 'saving' || saveTimeout) {
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
  }, [activeNote, editor, saveTimeout, updateNote, autosaveStatus]);

  // Handle title change
  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setTitle(newTitle);
      if (!activeNote) return;

      // Clear any pending content save
      if (saveTimeout) clearTimeout(saveTimeout);

      // Save title immediately (shorter debounce for titles)
      const timeout = setTimeout(async () => {
        setAutosaveStatus('saving');
        try {
          const result = await updateNote(activeNote.id, { title: newTitle });
          if (result) {
            setAutosaveStatus('saved');
            setLastSaved(new Date());
            setTimeout(() => setAutosaveStatus('idle'), 2000);
          } else {
            setAutosaveStatus('error');
          }
        } catch (error) {
          console.error('Title autosave failed:', error);
          setAutosaveStatus('error');
          setTimeout(() => setAutosaveStatus('idle'), 3000);
        }
      }, 500);
      setSaveTimeout(timeout);
    },
    [activeNote, updateNote],
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
        left={
          <div className="flex-1 min-w-0">
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Note"
              className="w-full text-xl font-semibold bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-2 h-auto placeholder:text-muted-foreground/60 text-foreground resize-none overflow-hidden"
              style={{ fontSize: '1.25rem', lineHeight: '1.75rem' }}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {activeNote?.filePath && <span className="font-mono">{activeNote.filePath}</span>}
            </div>
          </div>
        }
        right={
          <ContainerFlex align="center" gap="sm">
            {/* Enhanced Autosave Status Indicator */}
            <div className="flex items-center gap-2">
              {autosaveStatus === 'saving' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                  <Spinner size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Saving...
                  </span>
                </div>
              )}
              {autosaveStatus === 'saved' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800">
                  <Check size={14} className="text-green-600 dark:text-green-400" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-300">
                    Saved
                  </span>
                  {lastSaved && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                      {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              )}
              {autosaveStatus === 'error' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
                  <Warning size={14} className="text-red-600 dark:text-red-400" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">
                    Save failed
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <IconButton
                size="normal"
                icon={<Star size={16} />}
                tooltip="Toggle Favorite"
                onClick={() => toggleFavorite(activeNote.id)}
                className={activeNote.isFavorite ? 'bg-secondary text-yellow-600' : ''}
              />
              <IconButton
                size="normal"
                icon={<PushPin size={16} />}
                tooltip="Toggle Pin"
                onClick={() => togglePin(activeNote.id)}
                className={activeNote.isPinned ? 'bg-secondary text-blue-600' : ''}
              />
              <IconButton
                size="normal"
                icon={<Archive size={16} />}
                tooltip="Archive Note"
                onClick={() => {
                  toggleArchive(activeNote.id);
                  setActiveNote(null);
                }}
                className={activeNote.isArchived ? 'bg-secondary text-purple-600' : ''}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    size="normal"
                    icon={<DotsThreeVertical size={16} />}
                    tooltip="More Options"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

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
    </div>
  );
}
