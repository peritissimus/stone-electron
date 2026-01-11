/**
 * useTopicsData Hook - Manages topic loading, search, and filtering
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTopicStore } from '@renderer/stores/topicStore';
import { useTopicAPI } from '@renderer/hooks/useTopicAPI';

interface TopicNote {
  id: string;
  title: string;
  confidence?: number;
  isManual?: boolean;
}

export function useTopicsData() {
  const {
    topics,
    selectedTopicId,
    embeddingStatus,
    searchResults,
    searchQuery,
    classifying,
    error,
    selectTopic,
    setSearchQuery,
  } = useTopicStore();

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
  const [initializing, setInitializing] = useState(true);
  const [topicNotes, setTopicNotes] = useState<TopicNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [excludeJournal, setExcludeJournal] = useState(true);

  // Initialize topics
  useEffect(() => {
    const init = async () => {
      setInitializing(true);
      await initialize();
      await loadTopics({ excludeJournal });
      await getEmbeddingStatus();
      setInitializing(false);
    };
    init();
  }, [initialize, loadTopics, getEmbeddingStatus, excludeJournal]);

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
