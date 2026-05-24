/**
 * useRelatedNotes — per-note "related notes" fetcher for the editor sidecar.
 *
 * Service hook (no shared store): the request is scoped to a single noteId
 * and the renderer never needs to share this state. Cancels stale requests
 * when the active note changes so a slow lookup doesn't overwrite a faster
 * one for a different note.
 */

import { useEffect, useRef, useState } from 'react';
import type { RelatedNoteMatch } from '@shared/types';
import { searchAPI } from '@renderer/api/searchAPI';

interface UseRelatedNotesResult {
  results: RelatedNoteMatch[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRelatedNotes(noteId: string | null, limit = 5): UseRelatedNotesResult {
  const [results, setResults] = useState<RelatedNoteMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!noteId) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await searchAPI.getRelated({ noteId, limit });
        if (myRequestId !== requestIdRef.current) return;
        if (res.success && res.data) {
          setResults(res.data.results);
        } else {
          setResults([]);
          setError(res.error?.message ?? 'Failed to load related notes');
        }
      } catch (e) {
        if (myRequestId !== requestIdRef.current) return;
        setResults([]);
        setError(e instanceof Error ? e.message : 'Failed to load related notes');
      } finally {
        if (myRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    })();
  }, [noteId, limit, tick]);

  return { results, loading, error, refresh: () => setTick((t) => t + 1) };
}
