/**
 * useSidebarEvents Hook - Manages sidebar file/workspace/note event subscriptions
 */

import { useCallback } from 'react';
import { useFileEvents } from '@renderer/services/workspace/hooks/useFileEvents';
import { useNoteEvents } from '@renderer/features/notes/hooks/useNoteEvents';
import { useWorkspaceEvents } from '@renderer/services/workspace/hooks/useWorkspaceEvents';
import { useFileTreeStore } from '@renderer/services/workspace/model/fileTreeStore';
import { useNoteStore } from '@renderer/features/notes/model/noteStore';
import { useNoteAPI } from '@renderer/features/notes/commands/useNoteAPI';
import { useFileTreeAPI } from '@renderer/services/workspace/commands/useFileTreeAPI';
import { noteAPI } from '@renderer/api';
import { logger } from '@renderer/services/telemetry/logger';
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

  // Note created handler — NOTE_CREATED carries only { id } so we fetch the
  // note and addNote() it into the store. Without this, notes created by
  // non-CreateNote paths (e.g. OpenOrCreateJournalForDateUseCase) are only
  // reachable via the file-watcher round-trip, which leaves the sidebar
  // unable to highlight the newly-opened note until loadNotes fires.
  const handleNoteCreated = useCallback(async (payload: unknown) => {
    const data = payload as { id?: string; note?: Note };
    logger.debug('[Sidebar] NOTE_CREATED:', data);

    if (data.note) {
      useNoteStore.getState().addNote(data.note);
      return;
    }
    if (!data.id) return;

    try {
      const response = await noteAPI.getById(data.id);
      if (response.success && response.data) {
        useNoteStore.getState().addNote(response.data);
      }
    } catch (error) {
      logger.error('[Sidebar] Failed to hydrate newly-created note', { id: data.id, error });
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
    onCreated: handleNoteCreated,
    onUpdated: handleNoteUpdated,
  });
}
