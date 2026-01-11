/**
 * useSidebarEvents Hook - Manages sidebar file/workspace/note event subscriptions
 */

import { useCallback } from 'react';
import { useFileEvents } from '@renderer/hooks/useFileEvents';
import { useNoteEvents } from '@renderer/hooks/useNoteEvents';
import { useWorkspaceEvents } from '@renderer/hooks/useWorkspaceEvents';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { logger } from '@renderer/utils/logger';
import type { Note } from '@shared/types';

interface UseSidebarEventsOptions {
  activeFolder: string | null;
}

export function useSidebarEvents({ activeFolder }: UseSidebarEventsOptions) {
  const { loadFileTree } = useFileTreeAPI();
  const { loadNotes, loadNoteById } = useNoteAPI();

  // File created handler
  const handleFileCreated = useCallback(
    async (payload: unknown) => {
      const { addFileToTree } = useFileTreeStore.getState();
      const data = payload as { workspaceId: string; path: string };
      logger.debug('[Sidebar] FILE_CREATED:', data.path);

      // Add to tree optimistically
      const segments = data.path.split('/');
      const name = segments[segments.length - 1].replace(/\.md$/, '');
      addFileToTree(data.path, {
        name,
        path: data.path,
        type: 'file',
      });

      // Reload notes for the current folder
      if (activeFolder) {
        await loadNotes({ folderPath: activeFolder });
      } else {
        await loadNotes();
      }
    },
    [activeFolder, loadNotes],
  );

  // File changed handler
  const handleFileChanged = useCallback(
    async (payload: unknown) => {
      const { updateNoteByPath, getNoteByFilePath } = useNoteStore.getState();
      const data = payload as { workspaceId: string; path: string };
      logger.debug('[Sidebar] FILE_CHANGED:', data.path);

      const note = getNoteByFilePath(data.path);
      if (note) {
        const updatedNote = await loadNoteById(note.id);
        if (updatedNote) {
          updateNoteByPath(data.path, updatedNote);
        }
      }
    },
    [loadNoteById],
  );

  // File deleted handler
  const handleFileDeleted = useCallback((payload: unknown) => {
    const { removeFileFromTree } = useFileTreeStore.getState();
    const { removeNoteByPath } = useNoteStore.getState();
    const data = payload as { workspaceId: string; path: string };
    logger.debug('[Sidebar] FILE_DELETED:', data.path);

    removeFileFromTree(data.path);
    removeNoteByPath(data.path);
  }, []);

  // Workspace updated handler
  const handleWorkspaceUpdated = useCallback(async () => {
    logger.debug('[Sidebar] WORKSPACE_UPDATED - full refresh');
    await loadFileTree();
    if (activeFolder) {
      await loadNotes({ folderPath: activeFolder });
    } else {
      await loadNotes();
    }
  }, [activeFolder, loadFileTree, loadNotes]);

  // Note updated handler
  const handleNoteUpdated = useCallback((payload: unknown) => {
    const { updateNote: updateNoteInStore } = useNoteStore.getState();
    const data = payload as { note: Note };
    logger.debug('[Sidebar] NOTE_UPDATED:', data.note);

    if (data.note) {
      updateNoteInStore(data.note);
    }
  }, []);

  // Subscribe to all events
  useFileEvents({
    onCreated: handleFileCreated,
    onChanged: handleFileChanged,
    onDeleted: handleFileDeleted,
  });

  useWorkspaceEvents({
    onUpdated: handleWorkspaceUpdated,
  });

  useNoteEvents({
    onUpdated: handleNoteUpdated,
  });
}
