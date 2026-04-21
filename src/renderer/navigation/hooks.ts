import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * The id of the note currently rendered by the /note/:noteId route.
 * Returns null for any other route. This is the single source of truth
 * for "what note is open" — do not mirror it into a store.
 */
export function useActiveNoteId(): string | null {
  const params = useParams<{ noteId: string }>();
  return params.noteId ?? null;
}

/**
 * Single entry point for opening a note. Callers must not also mutate
 * fileTreeStore or noteStore — selection state is derived from the route
 * by useTreeSelectionSync.
 */
export function useNavigateToNote() {
  const navigate = useNavigate();
  return useCallback((noteId: string) => navigate(`/note/${noteId}`), [navigate]);
}
