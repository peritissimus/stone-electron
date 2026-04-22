/**
 * Quick Capture IPC Adapter - Handles quick capture IPC channels
 */

import { ipcMain } from 'electron';
import { QUICK_CAPTURE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  AppendToJournalRequestSchema,
  type AppendToJournalResponse,
} from '@shared/schemas';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface QuickCaptureIPCDeps {
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
}

export function registerQuickCaptureHandlers(deps: QuickCaptureIPCDeps): void {
  const { appendToJournal } = deps;

  ipcMain.handle(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL, async (_event, rawRequest) => {
    const request = AppendToJournalRequestSchema.parse(rawRequest);
    // Accept both 'text' and 'content' for flexibility.
    const text = request.text ?? request.content ?? '';
    return handleIpcRequest<AppendToJournalResponse>(
      async () => appendToJournal(text, request.workspaceId),
      {
        loggerPrefix: 'QuickCaptureIPC',
        defaultCode: 'QUICK_CAPTURE_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: {
          channel: QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL,
          workspaceId: request.workspaceId,
          textLength: text.length,
        },
      },
    );
  });

  logger.info('[IPC] QuickCapture handlers registered');
}

export function unregisterQuickCaptureHandlers(): void {
  ipcMain.removeHandler(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL);
}
