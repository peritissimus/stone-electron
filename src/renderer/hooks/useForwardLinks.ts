/**
 * useForwardLinks — the set of note ids the given note already wiki-links to.
 *
 * Service hook (no shared store), used by the Related panel to tell apart
 * "you could link this" from "already linked". Cancels stale requests when
 * the active note changes, same pattern as useRelatedNotes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { noteAPI } from '@renderer/api';

interface UseForwardLinksResult {
  linkedIds: Set<string>;
  refresh: () => void;
}

export function useForwardLinks(noteId: string | null): UseForwardLinksResult {
  const [linkedIds, setLinkedIds] = useState<Set<string>>(() => new Set());
  const [tick, setTick] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!noteId) {
      setLinkedIds(new Set());
      return;
    }
    const requestId = ++requestIdRef.current;
    void (async () => {
      try {
        const response = await noteAPI.getForwardLinks(noteId);
        if (requestIdRef.current !== requestId) return;
        if (response.success && response.data) {
          setLinkedIds(new Set(response.data.notes.map((n) => n.id)));
        }
      } catch {
        // Non-fatal — rows just won't show the "Linked" state.
      }
    })();
  }, [noteId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { linkedIds, refresh };
}
