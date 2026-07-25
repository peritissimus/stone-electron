/**
 * useTopicsData Hook - Workspace-scoped setup + debounced semantic search
 */

import { useEffect, useState } from 'react';
import { useTopicStore } from '@renderer/features/topics/model/topicStore';
import { useTopicAPI } from '@renderer/features/topics/commands/useTopicAPI';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';

export function useTopicsData() {
  const searchResults = useTopicStore((state) => state.searchResults);
  const searchQuery = useTopicStore((state) => state.searchQuery);
  const searching = useTopicStore((state) => state.loading);
  const error = useTopicStore((state) => state.error);
  const initialized = useTopicStore((state) => state.initialized);
  const initializedWorkspaceId = useTopicStore((state) => state.workspaceId);
  const markInitialized = useTopicStore((state) => state.markInitialized);
  const setSearchQuery = useTopicStore((state) => state.setSearchQuery);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const { initialize, semanticSearch, getEmbeddingStatus } = useTopicAPI();

  const [searchInput, setSearchInput] = useState('');
  const [initializing, setInitializing] = useState(
    () => !initialized || initializedWorkspaceId !== activeWorkspaceId,
  );

  // Initialize embeddings for the active workspace
  useEffect(() => {
    if (initialized && initializedWorkspaceId === activeWorkspaceId) {
      setInitializing(false);
      return;
    }
    const init = async () => {
      setInitializing(true);
      await initialize();
      await getEmbeddingStatus();
      markInitialized(activeWorkspaceId);
      setInitializing(false);
    };
    void init();
  }, [
    activeWorkspaceId,
    getEmbeddingStatus,
    initialize,
    initialized,
    initializedWorkspaceId,
    markInitialized,
  ]);

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

  return {
    // State
    searchResults,
    searchQuery,
    searchInput,
    searching,
    error,
    initializing,
    // Actions
    setSearchInput,
  };
}
