/**
 * Hook for journal-related actions
 * Provides functionality to open or create today's journal entry
 */

import { useNoteStore } from '@renderer/stores/noteStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { logger } from '@renderer/utils/logger';

/**
 * Get today's date formatted for journal
 */
function getTodayJournalInfo() {
  const now = new Date();

  // Full title (e.g., "December 14, 2025")
  const journalTitle = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Filename format (e.g., "2025-12-14")
  const journalFilename = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Expected file path
  const expectedFilePath = `Journal/${journalFilename}.md`;

  return { journalTitle, journalFilename, expectedFilePath };
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

    logger.info('[useJournalActions] Opening/creating today\'s journal', {
      journalFilename,
      journalTitle,
      expectedFilePath,
    });

    // Check if today's journal already exists using normalized path lookup
    const existingJournal = getNoteByFilePath(expectedFilePath);

    if (existingJournal) {
      logger.info('[useJournalActions] Opening existing journal', { id: existingJournal.id });
      navigateToNote(existingJournal.id);
      return existingJournal.id;
    }

    // Create new journal entry
    logger.info('[useJournalActions] Creating new journal entry');
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

    logger.error('[useJournalActions] Failed to create journal');
    return null;
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

  return {
    openOrCreateTodayJournal,
    todayJournalExists,
    getTodayInfo,
    navigateToNote,
  };
}
