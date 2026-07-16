/**
 * useTopicsData Hook - Manages topic loading, search, and filtering
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTopicStore } from '@renderer/features/topics/model/topicStore';
import { useTopicAPI } from '@renderer/features/topics/commands/useTopicAPI';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';

interface TopicNote {
  id: string;
  title: string;
  confidence?: number;
  isManual?: boolean;
}

export function useTopicsData() {
  const topics = useTopicStore((state) => state.topics);
  const selectedTopicId = useTopicStore((state) => state.selectedTopicId);
  const embeddingStatus = useTopicStore((state) => state.embeddingStatus);
  const searchResults = useTopicStore((state) => state.searchResults);
  const searchQuery = useTopicStore((state) => state.searchQuery);
  const classifying = useTopicStore((state) => state.classifying);
  const error = useTopicStore((state) => state.error);
  const initialized = useTopicStore((state) => state.initialized);
  const initializedWorkspaceId = useTopicStore((state) => state.workspaceId);
  const loadedExcludeJournal = useTopicStore((state) => state.loadedExcludeJournal);
  const excludeJournal = useTopicStore((state) => state.excludeJournal);
  const setExcludeJournal = useTopicStore((state) => state.setExcludeJournal);
  const markInitialized = useTopicStore((state) => state.markInitialized);
  const selectTopic = useTopicStore((state) => state.selectTopic);
  const setSearchQuery = useTopicStore((state) => state.setSearchQuery);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const {
    initialize,
    loadTopics,
    createTopic,
    semanticSearch,
    reclassifyAllNotes,
    getEmbeddingStatus,
    getNotesForTopic,
  } = useTopicAPI();

  const [searchInput, setSearchInput] = useState('');
  const [initializing, setInitializing] = useState(
    () =>
      !initialized ||
      initializedWorkspaceId !== activeWorkspaceId ||
      loadedExcludeJournal !== excludeJournal,
  );
  const [topicNotes, setTopicNotes] = useState<TopicNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Initialize topics
  useEffect(() => {
    if (
      initialized &&
      initializedWorkspaceId === activeWorkspaceId &&
      loadedExcludeJournal === excludeJournal
    ) {
      setInitializing(false);
      return;
    }
    const init = async () => {
      setInitializing(true);
      await initialize();
      await loadTopics({ excludeJournal });
      await getEmbeddingStatus();
      markInitialized(activeWorkspaceId, excludeJournal);
      setInitializing(false);
    };
    void init();
  }, [
    activeWorkspaceId,
    excludeJournal,
    getEmbeddingStatus,
    initialize,
    initialized,
    initializedWorkspaceId,
    loadedExcludeJournal,
    loadTopics,
    markInitialized,
  ]);

  // Load notes for selected topic
  useEffect(() => {
    if (selectedTopicId) {
      setLoadingNotes(true);
      getNotesForTopic(selectedTopicId, { excludeJournal })
        .then((notes) => setTopicNotes(notes as TopicNote[]))
        .finally(() => setLoadingNotes(false));
    } else {
      setTopicNotes([]);
    }
  }, [selectedTopicId, getNotesForTopic, excludeJournal]);

  // Debounced search
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchQuery('');
      return;
    }
    const timeout = setTimeout(() => {
      semanticSearch(searchInput);
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput, semanticSearch, setSearchQuery]);

  const handleTopicClick = useCallback(
    (topicId: string) => selectTopic(topicId === selectedTopicId ? null : topicId),
    [selectTopic, selectedTopicId],
  );

  const handleReclassify = useCallback(async () => {
    const ready = await initialize();
    if (ready) {
      await reclassifyAllNotes({ excludeJournal });
      await getEmbeddingStatus();
      await loadTopics({ excludeJournal });
    }
  }, [initialize, reclassifyAllNotes, getEmbeddingStatus, loadTopics, excludeJournal]);

  const handleCreateTopic = useCallback(
    async (name: string, color: string) => {
      await createTopic({ name: name.trim(), color });
      await loadTopics({ excludeJournal });
    },
    [createTopic, loadTopics, excludeJournal],
  );

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId),
    [topics, selectedTopicId],
  );

  return {
    // State
    topics,
    selectedTopicId,
    selectedTopic,
    topicNotes,
    embeddingStatus,
    searchResults,
    searchQuery,
    searchInput,
    classifying,
    error,
    initializing,
    loadingNotes,
    excludeJournal,
    // Actions
    setSearchInput,
    setExcludeJournal,
    handleTopicClick,
    handleReclassify,
    handleCreateTopic,
    selectTopic,
  };
}
