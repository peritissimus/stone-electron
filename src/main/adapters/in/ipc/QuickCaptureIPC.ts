/**
 * Quick Capture IPC Adapter - Handles quick capture IPC channels
 */

import { ipcMain } from 'electron';
import { logger } from '../../../shared';

const CHANNELS = {
  APPEND_TO_JOURNAL: 'quickCapture:appendToJournal',
} as const;

export interface QuickCaptureIPCDeps {
  appendToJournal: (content: string, workspaceId?: string) => Promise<{ noteId: string; appended: boolean }>;
}

export function registerQuickCaptureHandlers(deps: QuickCaptureIPCDeps): void {
  const { appendToJournal } = deps;

  ipcMain.handle(CHANNELS.APPEND_TO_JOURNAL, async (_, request: { text?: string; content?: string; workspaceId?: string }) => {
    try {
      // Accept both 'text' and 'content' for flexibility
      const text = request.text || request.content || '';
      logger.info('[IPC] quickCapture:appendToJournal', { textLength: text.length });
      const result = await appendToJournal(text, request.workspaceId);
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
