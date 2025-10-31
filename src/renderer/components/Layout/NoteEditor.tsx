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
import { Star, PushPin, Archive, DotsThreeVertical } from 'phosphor-react';
import { Input } from '@renderer/components/ui/input';
import { Button } from '@renderer/components/ui/button';
import { Text, Body } from '@renderer/components/ui/text';
import { ContainerFlex, ContainerCenter } from '@renderer/components/ui';

export function NoteEditor() {
  const { getActiveNote } = useNoteStore();
  const { updateNote, toggleFavorite, togglePin, toggleArchive } = useNoteAPI();
  const activeNote = getActiveNote();

  const [title, setTitle] = useState('');
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

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

      // Debounce save
      if (saveTimeout) clearTimeout(saveTimeout);
      const timeout = setTimeout(() => {
        updateNote(activeNote.id, { content: editor.getHTML() });
      }, 1000);
      setSaveTimeout(timeout);
    },
  });

  // Update editor when active note changes
  useEffect(() => {
    if (activeNote && editor) {
      setTitle(activeNote.title || '');
      if (activeNote.content !== editor.getHTML()) {
        editor.commands.setContent(activeNote.content);
      }
    }
  }, [activeNote?.id, editor]);

  // Handle title change
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      if (!activeNote) return;

      if (saveTimeout) clearTimeout(saveTimeout);
      const timeout = setTimeout(() => {
        updateNote(activeNote.id, { title: newTitle });
      }, 500);
      setSaveTimeout(timeout);
    },
    [activeNote, updateNote, saveTimeout],
  );

  if (!activeNote) {
    return (
      <div className="flex-1 bg-background">
        <ContainerCenter>
          <ContainerFlex direction="col" align="center" gap="xs">
            <Body>No note selected</Body>
            <Text size="xs" variant="muted">
              Select a note from the list or create a new one
            </Text>
          </ContainerFlex>
        </ContainerCenter>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Editor Header */}
      <div className="px-4 pt-titlebar pb-3 border-b border-border">
        <ContainerFlex align="center" gap="lg">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            className="flex-1 text-xl font-semibold bg-transparent border-none focus-visible:ring-0 px-0 py-0 h-auto placeholder:text-muted-foreground"
          />

          <ContainerFlex align="center" gap="xs">
            <Button
              onClick={() => toggleFavorite(activeNote.id)}
              variant={activeNote.isFavorite ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              title="Toggle Favorite"
            >
              <Star size={16} />
            </Button>
            <Button
              onClick={() => togglePin(activeNote.id)}
              variant={activeNote.isPinned ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              title="Toggle Pin"
            >
              <PushPin size={16} />
            </Button>
            <Button
              onClick={() => toggleArchive(activeNote.id)}
              variant={activeNote.isArchived ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              title="Toggle Archive"
            >
              <Archive size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="More Options">
              <DotsThreeVertical size={16} />
            </Button>
          </ContainerFlex>
        </ContainerFlex>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} />

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-6">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
