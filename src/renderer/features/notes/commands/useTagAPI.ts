/**
 * Tag API Hook - React hooks for tag operations
 *
 * Uses createEntityAPI for base CRUD, extends with tag-specific operations.
 */

import { useCallback } from 'react';
import { useTagStore } from '@renderer/features/notes/model/tagStore';
import type { IpcResponse, TagWithCount } from '@shared/types';
import { createEntityAPI } from '@renderer/services/data/createEntityAPI';
import { tagAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';

/**
 * Base CRUD operations from factory
 */
const useTagCRUD = createEntityAPI<TagWithCount, { sort?: 'name' | 'count' | 'recent' }>({
  entityName: 'tag',
  api: {
    list: async (params) => {
      const response = await tagAPI.getAll(params);
      return { ...response, data: response.data?.tags };
    },
    create: async (data) => {
      const response = await tagAPI.create({
        name: data.name ?? '',
        ...(data.color ? { color: data.color } : {}),
      });
      return {
        ...response,
        data: response.data ? { ...response.data, note_count: 0 } : undefined,
      } as IpcResponse<TagWithCount>;
    },
    remove: tagAPI.delete,
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
});

/**
 * Tag API hook with CRUD + tag-specific operations
 */
export function useTagAPI() {
  const { loadAll, create, remove } = useTagCRUD();
  const setError = useTagStore((state) => state.setError);

  /**
   * Load tags with optional sorting
   */
  const loadTags = useCallback(
    async (sort: 'name' | 'count' | 'recent' = 'name') => {
      return loadAll({ sort });
    },
    [loadAll],
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
    [setError],
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
    [setError],
  );

  return {
    loadTags,
    createTag: create,
    deleteTag: remove,
    addTagToNote,
    removeTagFromNote,
  };
}
