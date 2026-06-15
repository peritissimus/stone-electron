/**
 * Daily Review IPC Adapter — exposes today's snapshot to the renderer.
 */

import { ipcMain } from 'electron';
import { DAILY_REVIEW_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import type { IDailyReviewUseCases } from '../../../domain';

export interface DailyReviewIPCDeps {
  dailyReviewUseCases: IDailyReviewUseCases;
}

export function registerDailyReviewHandlers(deps: DailyReviewIPCDeps): void {
  const { dailyReviewUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'DailyReviewIPC',
      defaultCode: 'DAILY_REVIEW_ERROR',
      context,
    });

  ipcMain.handle(DAILY_REVIEW_CHANNELS.GET, async (_event, request) =>
    handleRequest(
      async () =>
        dailyReviewUseCases.getDailyReview.execute({
          workspaceId: request?.workspaceId,
          date: request?.date,
        }),
      { channel: DAILY_REVIEW_CHANNELS.GET, date: request?.date },
    ),
  );

  ipcMain.handle(DAILY_REVIEW_CHANNELS.SUMMARIZE, async (_event, request) =>
    handleRequest(
      async () =>
        dailyReviewUseCases.summarizeDailyReview.execute({
          workspaceId: request?.workspaceId,
          date: request?.date,
          saveToJournal: request?.saveToJournal,
        }),
      { channel: DAILY_REVIEW_CHANNELS.SUMMARIZE, date: request?.date },
    ),
  );
}

export function unregisterDailyReviewHandlers(): void {
  Object.values(DAILY_REVIEW_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
