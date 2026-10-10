import { useCallback, useEffect, useRef, useState } from 'react';
import { useDailyReviewStore } from '@renderer/features/daily-review/model/dailyReviewStore';
import { useNoteStore } from '@renderer/features/notes/model/noteStore';
import { useDocumentBufferStore } from '@renderer/services/documents/model/documentBufferStore';
import { useFileTreeStore } from '@renderer/services/workspace/model/fileTreeStore';
import { useUIStore } from '@renderer/services/view-state/model/uiStore';
import { useViewStateStore } from '@renderer/services/view-state/model/viewStateStore';
import { clearPathCache } from '@renderer/lib/pathCache';
import { clearAllDrafts } from '@renderer/services/documents/lib/draftStorage';
import { readStressScenario } from './scenarios';
import type { StressScenario } from './fixtures';

export interface StressBridgeControl {
  setScenario: (scenario: StressScenario) => void | Promise<void>;
}

export function useStressPreview(initial: StressScenario, bridge: StressBridgeControl) {
  const [scenario, setScenario] = useState(initial);
  const scenarioRef = useRef(initial);
  const [revision, setRevision] = useState(0);
  const [switching, setSwitching] = useState(false);

  const selectScenario = useCallback(
    async (next: StressScenario) => {
      setSwitching(true);
      await bridge.setScenario(next);
      clearPathCache();
      clearAllDrafts();
      useDocumentBufferStore.getState().clearAllBuffers();
      useNoteStore.getState().setNotes([]);
      useFileTreeStore.getState().setTree([]);
      useFileTreeStore.getState().setCounts({});
      useFileTreeStore.getState().collapseAll();
      useViewStateStore.setState({ scrollPositions: {} });
      useDailyReviewStore.getState().reset();
      const url = new URL(window.location.href);
      url.searchParams.set('data', next);
      url.hash = '/today';
      window.history.replaceState(null, '', url);
      setScenario(next);
      scenarioRef.current = next;
      setRevision((current) => current + 1);
      setSwitching(false);
    },
    [bridge],
  );

  useEffect(() => {
    // Expose the actual 240px sidebar without depending on saved preferences.
    const environment = new URLSearchParams(window.location.search);
    const width = Number(environment.get('sidebar') ?? 240);
    useUIStore.setState({
      sidebarOpen: environment.get('sidebar') !== 'collapsed',
      sidebarWidth: Number.isFinite(width) ? Math.max(200, Math.min(400, width)) : 240,
    });
    const unsubscribeTree = useFileTreeStore.subscribe((state, previous) => {
      if (state.tree !== previous.tree && environment.get('expand') === 'all') state.expandAll();
    });
    const onPopState = () => {
      const next = readStressScenario();
      if (next !== scenarioRef.current) void selectScenario(next);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      unsubscribeTree();
      window.removeEventListener('popstate', onPopState);
    };
  }, [selectScenario]);

  return { scenario, revision, switching, selectScenario };
}
