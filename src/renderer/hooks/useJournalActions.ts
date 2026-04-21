/**
 * Hook for journal-related actions
 * Provides functionality to open or create today's journal entry
 */

import { useCallback } from 'react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useNavigateToNote } from '@renderer/navigation';
import { logger } from '@renderer/lib/logger';

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
  const navigateToNote = useNavigateToNote();
  const { getNoteByFilePath } = useNoteStore();
  const { createNote } = useNoteAPI();

  /**
   * Open today's journal entry, creating it if it doesn't exist
   * Returns the note ID if successful, null otherwise
   */
  const openOrCreateTodayJournal = useCallback(async (): Promise<string | null> => {
    const { journalTitle, journalFilename, expectedFilePath } = getTodayJournalInfo();

    const existingJournal = getNoteByFilePath(expectedFilePath);
    if (existingJournal) {
      navigateToNote(existingJournal.id);
      return existingJournal.id;
    }

    try {
      const newNote = await createNote({
        title: journalFilename,
        content: `# ${journalTitle}\n\n`,
        folderPath: 'Journal',
      });

      if (newNote) {
        navigateToNote(newNote.id);
        return newNote.id;
      }

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
  }, [getNoteByFilePath, navigateToNote, createNote]);

  /**
   * Open yesterday's journal entry, creating it if it doesn't exist
   * Returns the note ID if successful, null otherwise
   */
  const openOrCreateYesterdayJournal = useCallback(async (): Promise<string | null> => {
    const { journalTitle, journalFilename, expectedFilePath } = getYesterdayJournalInfo();

    const existingJournal = getNoteByFilePath(expectedFilePath);
    if (existingJournal) {
      navigateToNote(existingJournal.id);
      return existingJournal.id;
    }

    try {
      const newNote = await createNote({
        title: journalFilename,
        content: `# ${journalTitle}\n\n`,
        folderPath: 'Journal',
      });

      if (newNote) {
        navigateToNote(newNote.id);
        return newNote.id;
      }

      logger.error("[useJournalActions] Failed to create yesterday's journal");
      return null;
    } catch (error) {
      logger.error("[useJournalActions] Exception creating yesterday's journal:", error);
      return null;
    }
  }, [getNoteByFilePath, navigateToNote, createNote]);

  /**
   * Check if today's journal exists
   */
  const todayJournalExists = useCallback((): boolean => {
    const { expectedFilePath } = getTodayJournalInfo();
    return getNoteByFilePath(expectedFilePath) !== null;
  }, [getNoteByFilePath]);

  const getTodayInfo = useCallback(() => getTodayJournalInfo(), []);
  const getYesterdayInfo = useCallback(() => getYesterdayJournalInfo(), []);

  return {
    openOrCreateTodayJournal,
    openOrCreateYesterdayJournal,
    todayJournalExists,
    getTodayInfo,
    getYesterdayInfo,
    navigateToNote,
  };
}
