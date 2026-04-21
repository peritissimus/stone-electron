/**
 * Journal IPC Adapter - Handles journal destination IPC channels
 */

import { ipcMain } from 'electron';
import { JOURNAL_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import type { IJournalUseCases } from '@domain';
import { logger } from '../../../shared';

export interface JournalIPCDeps {
  journalUseCases: IJournalUseCases;
}

export function registerJournalHandlers(deps: JournalIPCDeps): void {
  const { journalUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'JournalIPC',
      defaultCode: 'JOURNAL_ERROR',
      context,
    });

  ipcMain.handle(
    JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE,
    async (_, request: { date: string; workspaceId?: string }) => {
      return handleRequest(
        () => journalUseCases.openOrCreateForDate(request),
        { channel: JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE, date: request.date },
      );
    },
  );

  logger.info('[IPC] Journal handlers registered');
}

export function unregisterJournalHandlers(): void {
  ipcMain.removeHandler(JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE);
}
