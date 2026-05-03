/**
 * Hook for journal-related actions
 *
 * Resolves journal notes via the backend journal use case — the renderer
 * does not know the journal folder name, file layout, or seed content.
 * Date formatting here is purely for display; the authoritative identity
 * of the journal note is its noteId returned from the API.
 */

import { useCallback } from 'react';
import { useNavigateToNote } from '@renderer/navigation';
import { useJournalStore } from '@renderer/stores/journalStore';

function toIsoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function displayInfoForDate(date: Date) {
  const iso = toIsoDate(date);
  return { journalTitle: iso, journalFilename: iso };
}

async function openOrCreateForDate(
  date: Date | string,
  navigate: (id: string) => void,
  materialize: (date: string) => Promise<string | null>,
): Promise<string | null> {
  const journalDate = typeof date === 'string' ? date : toIsoDate(date);
  const noteId = await materialize(journalDate);
  if (!noteId) {
    return null;
  }
  navigate(noteId);
  return noteId;
}

export function useJournalActions() {
  const navigateToNote = useNavigateToNote();
  const materialize = useJournalStore((state) => state.materialize);

  const openOrCreateTodayJournal = useCallback(
    () => openOrCreateForDate(new Date(), navigateToNote, materialize),
    [navigateToNote, materialize],
  );

  const openOrCreateYesterdayJournal = useCallback(
    () => openOrCreateForDate(yesterday(), navigateToNote, materialize),
    [navigateToNote, materialize],
  );

  const openOrCreateJournalForDate = useCallback(
    (date: Date | string) => openOrCreateForDate(date, navigateToNote, materialize),
    [navigateToNote, materialize],
  );

  const getTodayInfo = useCallback(() => displayInfoForDate(new Date()), []);
  const getYesterdayInfo = useCallback(() => displayInfoForDate(yesterday()), []);

  return {
    openOrCreateTodayJournal,
    openOrCreateYesterdayJournal,
    openOrCreateJournalForDate,
    getTodayInfo,
    getYesterdayInfo,
    navigateToNote,
  };
}
