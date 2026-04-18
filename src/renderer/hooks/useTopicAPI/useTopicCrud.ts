import { useCallback } from 'react';
import { useTopicStore } from '@renderer/stores/topicStore';
import type { TopicWithCount } from '@shared/types';
import { TOPIC_CHANNELS } from '@shared/constants/ipcChannels';
import { createEntityAPI } from '../createEntityAPI';
import { topicAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';

const useTopicCRUD = createEntityAPI<TopicWithCount>({
  entityName: 'topic',
  channels: {
    GET_ALL: TOPIC_CHANNELS.GET_ALL,
    CREATE: TOPIC_CHANNELS.CREATE,
    UPDATE: TOPIC_CHANNELS.UPDATE,
    DELETE: TOPIC_CHANNELS.DELETE,
  },
  useStore: () => {
    const store = useTopicStore();
    return {
      setItems: store.setTopics,
      addItem: store.addTopic,
      updateItem: (topic: TopicWithCount) => store.updateTopic(topic.id, topic),
      deleteItem: store.deleteTopic,
      setLoading: store.setLoading,
      setError: store.setError,
    };
  },
  responseKey: 'topics',
  logPrefix: '[TopicAPI]',
});

export function useTopicCrud() {
  const { loadAll, create, update, remove } = useTopicCRUD();
  const { setError } = useTopicStore();

  const loadTopics = useCallback(
    async (options?: { excludeJournal?: boolean }) => {
      console.log('[TopicAPI] Loading topics...', options);
      const result = await loadAll(options || {});
      console.log('[TopicAPI] Loaded topics:', result);
      return result;
    },
    [loadAll],
  );

  const createTopic = useCallback(
    async (data: { name: string; description?: string; color?: string }) => {
      return create(data as Partial<TopicWithCount>);
    },
    [create],
  );

  const updateTopicById = useCallback(
    async (id: string, data: { name?: string; description?: string; color?: string }) => {
      return update(id, data as Partial<TopicWithCount>);
    },
    [update],
  );

  const getNotesForTopic = useCallback(
    async (
      topicId: string,
      options?: { limit?: number; offset?: number; excludeJournal?: boolean },
    ) => {
      setError(null);
      try {
        const response = await topicAPI.getNotesByTopic(topicId, options);
        const result = handleIpcResponse(response, 'Failed to get notes for topic');
        return result.success ? result.data.notes : [];
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to get notes for topic');
        return [];
      }
    },
    [setError],
  );

  const assignTopicToNote = useCallback(
    async (noteId: string, topicId: string) => {
      setError(null);
      try {
        const response = await topicAPI.assignToNote(noteId, topicId);
        return response.success;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to assign topic to note');
        return false;
      }
    },
    [setError],
  );

  const removeTopicFromNote = useCallback(
    async (noteId: string, topicId: string) => {
      setError(null);
      try {
        const response = await topicAPI.removeFromNote(noteId, topicId);
        return response.success;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to remove topic from note');
        return false;
      }
    },
    [setError],
  );

  return {
    loadTopics,
    createTopic,
    updateTopic: updateTopicById,
    deleteTopic: remove,
    getNotesForTopic,
    assignTopicToNote,
    removeTopicFromNote,
  };
}
