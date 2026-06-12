import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toToday, toNote } from './routes';

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
 * fileTreeStore or noteStore — tree selection is derived from the route
 * by useTreeSelection (read-only), and ancestor folders are auto-expanded
 * by useAutoExpandAncestors mounted once at the app root.
 */
export function useNavigateToNote() {
  const navigate = useNavigate();
  return useCallback((noteId: string) => navigate(toNote(noteId)), [navigate]);
}

/**
 * Navigate to the app's landing page. Home IS the Today page — the old
 * /home view was removed in favor of it.
 */
export function useNavigateHome() {
  const navigate = useNavigate();
  return useCallback(() => navigate(toToday()), [navigate]);
}
