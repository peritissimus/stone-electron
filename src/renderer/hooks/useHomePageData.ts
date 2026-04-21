/**
 * useHomePageData Hook - Manages HomePage state and actions
 */

import { useRef, useMemo, useCallback } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { useQuickNoteActions } from '@renderer/hooks/useQuickNoteActions';
import { useNavigateToNote } from '@renderer/navigation';
import { logger } from '@renderer/lib/logger';
import type { Note } from '@shared/types';

export function useHomePageData() {
  const navigateToNote = useNavigateToNote();
  const { notes } = useNoteStore();
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const { openOrCreateTodayJournal, getTodayInfo } = useJournalActions();
  const { createWork } = useQuickNoteActions();

  // Prevent double-click creating duplicate notes
  const isCreatingNote = useRef(false);

  // Get recent notes (last 5, sorted by update time)
  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [notes],
  );

  // Get the most recent note for "Continue writing"
  const continueNote = recentNotes[0] as Note | undefined;

  // Today's date info
  const { journalFilename, todayDateString, journalTitle } = useMemo(() => {
    const info = getTodayInfo();
    const now = new Date();
    return {
      journalFilename: info.journalFilename,
      journalTitle: now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      todayDateString: now.toDateString(),
    };
  }, [getTodayInfo]);

  // Check if we have today's journal. Identified by title (YYYY-MM-DD) — the
  // backend journal use case owns the actual folder/path layout, so the
  // renderer doesn't hard-code a folder here.
  const todaysJournal = useMemo(
    () => notes.find((note) => note.title === journalFilename),
    [notes, journalFilename],
  );

  // Stats
  const totalNotes = notes.length;
  const todayNotes = useMemo(
    () => notes.filter((n) => new Date(n.updatedAt).toDateString() === todayDateString).length,
    [notes, todayDateString],
  );

  const handleNoteClick = useCallback(
    (noteId: string) => {
      logger.info('[HomePage] Note clicked', { noteId });
      navigateToNote(noteId);
    },
    [navigateToNote],
  );

  // Handle journal click - open or create today's journal
  const handleJournalClick = useCallback(async () => {
    logger.info('[HomePage] Journal clicked', { journalFilename });
    await openOrCreateTodayJournal();
  }, [journalFilename, openOrCreateTodayJournal]);

  // Handle work note click - create via the backend quick-note slot so the
  // renderer doesn't know the folder mapping.
  const handleWorkNoteClick = useCallback(async () => {
    if (isCreatingNote.current) {
      logger.info('[HomePage] Already creating note, ignoring click');
      return;
    }
    isCreatingNote.current = true;
    try {
      await createWork();
    } finally {
      isCreatingNote.current = false;
    }
  }, [createWork]);

  return {
    // Data
    notes,
    recentNotes,
    continueNote,
    todaysJournal,
    journalFilename,
    journalTitle,
    totalNotes,
    todayNotes,

    // UI state
    sidebarOpen,
    toggleSidebar,

    // Actions
    handleNoteClick,
    handleJournalClick,
    handleWorkNoteClick,
  };
}
