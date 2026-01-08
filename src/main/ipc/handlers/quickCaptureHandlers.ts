/**
 * Quick Capture IPC Handlers
 * Handle quick capture operations - append text to today's journal
 */

import { format } from 'date-fns';
import { QUICK_CAPTURE_CHANNELS } from '@shared/constants/ipcChannels';
import { registerHandler } from '../utils';
import { logger } from '../../utils/logger';
import type { Container } from '../../api/container';
import type { AwilixContainer } from 'awilix';

interface AppendToJournalRequest {
  text: string;
}

/**
 * Register all quick capture handlers
 */
export function registerQuickCaptureHandlers(container: AwilixContainer<Container>) {
  const noteService = container.resolve('noteService');
  const noteRepository = container.resolve('noteRepository');

  // quickCapture:appendToJournal
  registerHandler(
    QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL,
    async (_event, request: AppendToJournalRequest) => {
      const { text } = request;

      if (!text?.trim()) {
        throw new Error('Text is required');
      }

      const today = new Date();
      const journalFilename = format(today, 'yyyy-MM-dd');
      const journalPath = `Journal/${journalFilename}.md`;
      const timestamp = format(today, 'h:mm a');

      logger.info('[QuickCapture] Appending to journal', {
        journalPath,
        timestamp,
        textLength: text.length,
      });

      // Find or create today's journal
      let journal = await noteRepository.findByFilePath(journalPath);

      if (!journal) {
        logger.info('[QuickCapture] Creating new journal entry');
        journal = await noteService.createNote({
          title: journalFilename,
          folderPath: 'Journal',
        });
      }

      // Load current content
      const currentContent = await noteService.getContent(journal.id);
      if (currentContent === null) {
        throw new Error('Failed to load journal content');
      }

      // Append timestamped entry
      const entry = `${timestamp} - ${text.trim()}`;
      const updatedContent = currentContent.trim() + '\n\n' + entry;

      // Save
      await noteService.updateContent(journal.id, updatedContent);

      logger.info('[QuickCapture] Successfully appended to journal', {
        noteId: journal.id,
        entry,
      });

      return { success: true, noteId: journal.id };
    }
  );

  logger.info('[IPC] Quick capture handlers registered');
}
