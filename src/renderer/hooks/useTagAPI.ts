/**
 * Tag API Hook - React hooks for tag operations
 */

import { useCallback } from 'react';
import { useTagStore } from '@renderer/stores/tagStore';
import { TagWithCount } from '@shared/types';
import { TAG_CHANNELS } from '@shared/constants/ipcChannels';

export function useTagAPI() {
  const { setTags, addTag, updateTag, deleteTag, setLoading, setError } = useTagStore();

  const loadTags = useCallback(
    async (sort: 'name' | 'count' | 'recent' = 'name') => {
      setLoading(true);
      setError(null);
      try {
        const response = await window.electron.invoke<{ tags: TagWithCount[] }>(
          TAG_CHANNELS.GET_ALL,
          { sort },
        );
        if (response.success && response.data) {
          setTags(response.data.tags);
        } else {
          setError(response.error?.message || 'Failed to load tags');
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load tags');
      } finally {
        setLoading(false);
      }
    },
    [setTags, setLoading, setError],
  );

  const createTag = useCallback(
    async (data: { name: string; color?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const response = await window.electron.invoke<TagWithCount>(TAG_CHANNELS.CREATE, data);
        if (response.success && response.data) {
          addTag(response.data);
          return response.data;
        } else {
          setError(response.error?.message || 'Failed to create tag');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to create tag');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [addTag, setLoading, setError],
  );

  const deleteTagById = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke(TAG_CHANNELS.DELETE, { id });
        if (response.success) {
          deleteTag(id);
          return true;
        } else {
          setError(response.error?.message || 'Failed to delete tag');
          return false;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to delete tag');
        return false;
      }
    },
    [deleteTag, setError],
  );

  const addTagToNote = useCallback(
    async (noteId: string, tagIds: string[]) => {
      setError(null);
      try {
        const response = await window.electron.invoke<{ tags: TagWithCount[] }>(
          TAG_CHANNELS.ADD_TO_NOTE,
          {
            noteId: noteId,
            tagIds: tagIds,
          },
        );
        if (response.success && response.data) {
          return response.data.tags;
        } else {
          setError(response.error?.message || 'Failed to add tag to note');
          return null;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to add tag to note');
        return null;
      }
    },
    [setError],
  );

  const removeTagFromNote = useCallback(
    async (noteId: string, tagId: string) => {
      setError(null);
      try {
        const response = await window.electron.invoke(TAG_CHANNELS.REMOVE_FROM_NOTE, {
          noteId: noteId,
          tagId: tagId,
        });
        if (response.success) {
          return true;
        } else {
          setError(response.error?.message || 'Failed to remove tag from note');
          return false;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to remove tag from note');
        return false;
      }
    },
    [setError],
  );

  return {
    loadTags,
    createTag,
    deleteTag: deleteTagById,
    addTagToNote,
    removeTagFromNote,
  };
}
