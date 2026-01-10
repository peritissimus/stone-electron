/**
 * Hook for journal-related actions
 * Provides functionality to open or create today's journal entry
 */

import { useNoteStore } from '@renderer/stores/noteStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/utils/logger';

/**
 * Get journal info for a specific date
 */
function getJournalInfoForDate(date: Date) {
  // Filename format (e.g., "2025-12-14")
  const journalFilename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  // Expected file path
  const expectedFilePath = `Journal/${journalFilename}.md`;

  return { journalTitle: journalFilename, journalFilename, expectedFilePath };
}

/**
 * Get today's date formatted for journal
 */
function getTodayJournalInfo() {
  return getJournalInfoForDate(new Date());
}

/**
 * Get yesterday's date formatted for journal
 */
function getYesterdayJournalInfo() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getJournalInfoForDate(yesterday);
}

export function useJournalActions() {
  const { setActiveNote, getNoteByFilePath } = useNoteStore();
  const { setSelectedFile, setActiveFolder } = useFileTreeStore();
  const { createNote } = useNoteAPI();

  /**
   * Navigate to a note by ID - sets active note and updates file tree selection
   */
  const navigateToNote = (noteId: string) => {
    // Get fresh notes from store to avoid stale closure
    const notes = useNoteStore.getState().notes;
    const note = notes.find((n) => n.id === noteId);

    if (note?.filePath) {
      // Normalize the path to match FileTree's normalization
      const normalizedPath = note.filePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      setSelectedFile(normalizedPath);

      // Extract folder path from the file path
      const lastSlash = normalizedPath.lastIndexOf('/');
      if (lastSlash > 0) {
        const folderPath = normalizedPath.substring(0, lastSlash);
        setActiveFolder(folderPath);
      }
    }

    setActiveNote(noteId);
  };

  /**
   * Open today's journal entry, creating it if it doesn't exist
   * Returns the note ID if successful, null otherwise
   */
  const openOrCreateTodayJournal = async (): Promise<string | null> => {
    const { journalTitle, journalFilename, expectedFilePath } = getTodayJournalInfo();

    // Debug: Log all notes to see what paths are in the store
    const allNotes = useNoteStore.getState().notes;
    const journalNotes = allNotes.filter((n) => n.filePath?.includes('Journal'));

    logger.info("[useJournalActions] Opening/creating today's journal", {
      journalFilename,
      journalTitle,
      expectedFilePath,
      totalNotes: allNotes.length,
      journalNotesInStore: journalNotes.map((n) => ({ id: n.id, filePath: n.filePath })),
    });

    // Check if today's journal already exists using normalized path lookup
    const existingJournal = getNoteByFilePath(expectedFilePath);
    logger.info('[useJournalActions] Lookup result:', {
      found: !!existingJournal,
      existingId: existingJournal?.id,
      existingPath: existingJournal?.filePath,
    });

    if (existingJournal) {
      logger.info('[useJournalActions] Opening existing journal', { id: existingJournal.id });
      navigateToNote(existingJournal.id);
      return existingJournal.id;
    }

    // Create new journal entry
    logger.info('[useJournalActions] Creating new journal entry');
    try {
      const { journalTitle } = getTodayJournalInfo();
      const newNote = await createNote({
        title: journalFilename,
        content: `# ${journalTitle}\n\n`,
        folderPath: 'Journal',
      });

      if (newNote) {
        logger.info('[useJournalActions] Journal created', { id: newNote.id });
        navigateToNote(newNote.id);
        return newNote.id;
      }

      // Check if there's an error in the store
      const storeError = useNoteStore.getState().error;
      logger.error('[useJournalActions] Failed to create journal', {
        storeError,
        noteWasNull: newNote === null,
      });
      return null;
    } catch (error) {
      logger.error('[useJournalActions] Exception creating journal:', error);
      return null;
    }
  };

  /**
   * Open yesterday's journal entry, creating it if it doesn't exist
   * Returns the note ID if successful, null otherwise
   */
  const openOrCreateYesterdayJournal = async (): Promise<string | null> => {
    const { journalTitle, journalFilename, expectedFilePath } = getYesterdayJournalInfo();

    logger.info("[useJournalActions] Opening/creating yesterday's journal", {
      journalFilename,
      journalTitle,
      expectedFilePath,
    });

    // Check if yesterday's journal already exists using normalized path lookup
    const existingJournal = getNoteByFilePath(expectedFilePath);

    if (existingJournal) {
      logger.info('[useJournalActions] Opening existing journal', { id: existingJournal.id });
      navigateToNote(existingJournal.id);
      return existingJournal.id;
    }

    // Create new journal entry
    logger.info('[useJournalActions] Creating new journal entry for yesterday');
    try {
      const newNote = await createNote({
        title: journalFilename,
        content: `# ${journalTitle}\n\n`,
        folderPath: 'Journal',
      });

      if (newNote) {
        logger.info("[useJournalActions] Yesterday's journal created", { id: newNote.id });
        navigateToNote(newNote.id);
        return newNote.id;
      }

      logger.error("[useJournalActions] Failed to create yesterday's journal");
      return null;
    } catch (error) {
      logger.error("[useJournalActions] Exception creating yesterday's journal:", error);
      return null;
    }
  };

  /**
   * Check if today's journal exists
   */
  const todayJournalExists = (): boolean => {
    const { expectedFilePath } = getTodayJournalInfo();
    // Use normalized path lookup for accurate check
    return getNoteByFilePath(expectedFilePath) !== null;
  };

  /**
   * Get today's journal info for display purposes
   */
  const getTodayInfo = () => getTodayJournalInfo();

  /**
   * Get yesterday's journal info for display purposes
   */
  const getYesterdayInfo = () => getYesterdayJournalInfo();

  return {
    openOrCreateTodayJournal,
    openOrCreateYesterdayJournal,
    todayJournalExists,
    getTodayInfo,
    getYesterdayInfo,
    navigateToNote,
  };
}
