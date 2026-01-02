/**
 * Tag API Hook - React hooks for tag operations
 *
 * Uses createEntityAPI for base CRUD, extends with tag-specific operations.
 */

import { useCallback } from 'react';
import { useTagStore } from '@renderer/stores/tagStore';
import { TagWithCount } from '@shared/types';
import { TAG_CHANNELS } from '@shared/constants/ipcChannels';
import { createEntityAPI } from './createEntityAPI';
import { tagAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';

/**
 * Base CRUD operations from factory
 */
const useTagCRUD = createEntityAPI<TagWithCount>({
  entityName: 'tag',
  channels: {
    GET_ALL: TAG_CHANNELS.GET_ALL,
    CREATE: TAG_CHANNELS.CREATE,
    DELETE: TAG_CHANNELS.DELETE,
  },
  useStore: () => {
    const store = useTagStore();
    return {
      setItems: store.setTags,
      addItem: store.addTag,
      updateItem: store.updateTag,
      deleteItem: store.deleteTag,
      setLoading: store.setLoading,
      setError: store.setError,
    };
  },
  responseKey: 'tags',
  logPrefix: '[TagAPI]',
});

/**
 * Tag API hook with CRUD + tag-specific operations
 */
export function useTagAPI() {
  const { loadAll, create, remove } = useTagCRUD();
  const { setError } = useTagStore();

  /**
   * Load tags with optional sorting
   */
  const loadTags = useCallback(
    async (sort: 'name' | 'count' | 'recent' = 'name') => {
      return loadAll({ sort });
    },
    [loadAll]
  );

  /**
   * Add tags to a note
   */
  const addTagToNote = useCallback(
    async (noteId: string, tagIds: string[]) => {
      setError(null);
      try {
        const response = await tagAPI.addToNote(noteId, tagIds);
        const result = handleIpcResponse(response, 'Failed to add tag to note');
        if (result.success) {
          return result.data.tags;
        }
        setError(result.error);
        return null;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to add tag to note');
        return null;
      }
    },
    [setError]
  );

  /**
   * Remove a tag from a note
   */
  const removeTagFromNote = useCallback(
    async (noteId: string, tagId: string) => {
      setError(null);
      try {
        const response = await tagAPI.removeFromNote(noteId, tagId);
        if (response.success) {
          return true;
        }
        setError(response.error?.message || 'Failed to remove tag from note');
        return false;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to remove tag from note');
        return false;
      }
    },
    [setError]
  );

  return {
    loadTags,
    createTag: create,
    deleteTag: remove,
    addTagToNote,
    removeTagFromNote,
  };
}
