/**
 * Note Content Hook - Handles loading and managing note content
 */

import { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';

export interface UseNoteContentOptions {
  activeNote: { id: string; title: string | null } | null;
  editor: Editor | null;
}

export function useNoteContent({ activeNote, editor }: UseNoteContentOptions) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  // Handle title change
  const handleTitleChange = useCallback(
    async (newTitle: string, saveTitle: (title: string) => Promise<void>) => {
      setTitle(newTitle);
      await saveTitle(newTitle);
    },
    [],
  );

  return {
    title,
    content,
    isLoading,
    handleTitleChange,
  };
}
