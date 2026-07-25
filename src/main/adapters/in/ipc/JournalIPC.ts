/**
 * Journal IPC Adapter - Handles journal destination IPC channels
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { JOURNAL_CHANNELS } from '@shared/constants/ipcChannels';
import {
  ListJournalRangeRequestSchema,
  type ListJournalRangeResponse,
  OpenOrCreateJournalRequestSchema,
  type OpenOrCreateJournalResponse,
} from '@shared/schemas';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';
import type { IJournalUseCases } from '@domain';
import { logger } from '../../../shared';

export interface JournalIPCDeps {
  runJournalEffect: RunJournalEffect;
}

export type RunJournalEffect = <A, E>(
  use: (service: IJournalUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerJournalHandlers(deps: JournalIPCDeps): void {
  const run = deps.runJournalEffect;

  ipcMain.handle(JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE, async (_event, rawRequest) => {
    const request = OpenOrCreateJournalRequestSchema.parse(rawRequest);
    return handleIpcRequest<OpenOrCreateJournalResponse>(
      () => run((service) => service.openOrCreateForDate(request)),
      {
        loggerPrefix: 'JournalIPC',
        defaultCode: 'JOURNAL_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: { channel: JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE, date: request.date },
      },
    );
  });

  ipcMain.handle(JOURNAL_CHANNELS.LIST_RANGE, async (_event, rawRequest) => {
    const request = ListJournalRangeRequestSchema.parse(rawRequest);
    return handleIpcRequest<ListJournalRangeResponse>(() =>
      run((service) => service.listRange(request)), {
      loggerPrefix: 'JournalIPC',
      defaultCode: 'JOURNAL_ERROR',
      errorMap: { ...COMMON_IPC_ERROR_MAP },
      context: {
        channel: JOURNAL_CHANNELS.LIST_RANGE,
        limit: request.limit,
      },
    });
  });

  logger.info('[IPC] Journal handlers registered');
}

export function unregisterJournalHandlers(): void {
  ipcMain.removeHandler(JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE);
  ipcMain.removeHandler(JOURNAL_CHANNELS.LIST_RANGE);
}
