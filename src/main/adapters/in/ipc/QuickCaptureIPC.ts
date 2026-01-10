/**
 * Quick Capture IPC Adapter - Handles quick capture IPC channels
 */

import { ipcMain } from 'electron';
import { QUICK_CAPTURE_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface QuickCaptureIPCDeps {
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
}

export function registerQuickCaptureHandlers(deps: QuickCaptureIPCDeps): void {
  const { appendToJournal } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'QuickCaptureIPC',
      defaultCode: 'QUICK_CAPTURE_ERROR',
      context,
    });

  ipcMain.handle(
    QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL,
    async (_, request: { text?: string; content?: string; workspaceId?: string }) => {
      return handleRequest(
        async () => {
          // Accept both 'text' and 'content' for flexibility
          const text = request.text || request.content || '';
          const result = await appendToJournal(text, request.workspaceId);
          return result;
        },
        {
          channel: QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL,
          workspaceId: request.workspaceId,
          textLength: (request.text || request.content || '').length,
        },
      );
    },
  );

  logger.info('[IPC] QuickCapture handlers registered');
}

export function unregisterQuickCaptureHandlers(): void {
  ipcMain.removeHandler(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL);
}
