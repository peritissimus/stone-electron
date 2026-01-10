/**
 * Note Content Hook - Handles loading and managing note content
 */

import { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { noteAPI } from '@renderer/api';
import { logger } from '@renderer/utils/logger';

export interface UseNoteContentOptions {
  activeNote: { id: string; title: string | null } | null;
  editor: Editor | null;
}

export function useNoteContent({ activeNote, editor }: UseNoteContentOptions) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync title from activeNote when it changes externally
  useEffect(() => {
    if (activeNote?.title !== undefined) {
      setTitle(activeNote.title || '');
    }
  }, [activeNote?.title]);

  // Load content when active note changes
  useEffect(() => {
    logger.debug('[useNoteContent] Effect triggered', {
      activeNoteId: activeNote?.id,
      editorReady: !!editor,
    });
    if (!activeNote || !editor) {
      logger.debug('[useNoteContent] Skipping - activeNote or editor missing', {
        activeNote: !!activeNote,
        editor: !!editor,
      });
      return;
    }

    const loadContent = async () => {
      logger.debug('[useNoteContent] Loading content for note:', activeNote.id);
      setIsLoading(true);
      // Title is handled by the other effect

      try {
        // Load content from file via API layer
        const response = await noteAPI.getContent(activeNote.id);

        if (response.success && response.data) {
          const loadedContent = response.data.content;
          setContent(loadedContent);
          editor.commands.setContent(loadedContent);
        }
      } catch (error) {
        logger.error('Failed to load note content:', error);
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
