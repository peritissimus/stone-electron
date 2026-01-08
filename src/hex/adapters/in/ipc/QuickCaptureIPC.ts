/**
 * Quick Capture IPC Adapter - Handles quick capture IPC channels
 */

import { ipcMain } from 'electron';
import { logger } from '../../../shared/utils';

const CHANNELS = {
  APPEND_TO_JOURNAL: 'quickCapture:appendToJournal',
} as const;

export interface QuickCaptureIPCDeps {
  appendToJournal: (content: string, workspaceId?: string) => Promise<{ noteId: string; appended: boolean }>;
}

export function registerQuickCaptureHandlers(deps: QuickCaptureIPCDeps): void {
  const { appendToJournal } = deps;

  ipcMain.handle(CHANNELS.APPEND_TO_JOURNAL, async (_, text: string, workspaceId?: string) => {
    try {
      logger.info('[IPC] quickCapture:appendToJournal', { textLength: text.length });
      const result = await appendToJournal(text, workspaceId);
      return { success: true, data: result };
    } catch (error) {
      logger.error('[IPC] quickCapture:appendToJournal error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  logger.info('[IPC] QuickCapture handlers registered');
}

export function unregisterQuickCaptureHandlers(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
