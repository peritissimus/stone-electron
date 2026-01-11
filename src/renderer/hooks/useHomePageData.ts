/**
 * useHomePageData Hook - Manages HomePage state and actions
 */

import { useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useSidebarUI } from '@renderer/hooks/useUI';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useJournalActions } from '@renderer/hooks/useJournalActions';
import { logger } from '@renderer/utils/logger';
import type { Note } from '@shared/types';

/**
 * Normalize path for comparison
 */
function normalizePath(path: string | null): string {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
}

export function useHomePageData() {
  const navigate = useNavigate();
  const { notes } = useNoteStore();
  const { setSelectedFile, setActiveFolder } = useFileTreeStore();
  const { toggleSidebar, sidebarOpen } = useSidebarUI();
  const { createNote } = useNoteAPI();
  const { openOrCreateTodayJournal, getTodayInfo } = useJournalActions();

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

  // Check if we have today's journal
  const todaysJournal = useMemo(() => {
    const expectedJournalPath = `Journal/${journalFilename}.md`;
    const normalizedExpectedPath = normalizePath(expectedJournalPath);
    return notes.find((note) => normalizePath(note.filePath) === normalizedExpectedPath);
  }, [notes, journalFilename]);

  // Stats
  const totalNotes = notes.length;
  const todayNotes = useMemo(
    () => notes.filter((n) => new Date(n.updatedAt).toDateString() === todayDateString).length,
    [notes, todayDateString],
  );

  // Handle note click - navigate to note using router
  const handleNoteClick = useCallback(
    (noteId: string) => {
      logger.info('[HomePage] Note clicked', { noteId });

      const note = notes.find((n) => n.id === noteId);
      if (note?.filePath) {
        const normalizedPath = note.filePath
          .replace(/\\/g, '/')
          .replace(/^\/+/, '')
          .replace(/\/+$/, '');

        setSelectedFile(normalizedPath);

        const lastSlash = normalizedPath.lastIndexOf('/');
        if (lastSlash > 0) {
          const folderPath = normalizedPath.substring(0, lastSlash);
          setActiveFolder(folderPath);
        }
      }

      // Navigate using router
      navigate(`/note/${noteId}`);
    },
    [notes, setSelectedFile, setActiveFolder, navigate],
  );

  // Handle journal click - open or create today's journal
  const handleJournalClick = useCallback(async () => {
    logger.info('[HomePage] Journal clicked', { journalFilename });
    await openOrCreateTodayJournal();
  }, [journalFilename, openOrCreateTodayJournal]);

  // Handle work note click - create a new note in Work folder
  const handleWorkNoteClick = useCallback(async () => {
    if (isCreatingNote.current) {
      logger.info('[HomePage] Already creating note, ignoring click');
      return;
    }
    isCreatingNote.current = true;

    logger.info('[HomePage] Work note clicked');
    try {
      const newNote = await createNote({
        title: 'Untitled',
        content: '',
        folderPath: 'Work',
      });

      if (newNote) {
        logger.info('[HomePage] Work note created', { id: newNote.id });
        navigate(`/note/${newNote.id}`);
      }
    } finally {
      isCreatingNote.current = false;
    }
  }, [createNote, navigate]);

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
