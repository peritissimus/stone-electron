/**
 * Daily Review IPC Adapter — exposes today's snapshot to the renderer.
 */

import { ipcMain } from 'electron';
import { z } from 'zod';
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

  const LoadIntegrationRequestSchema = z.object({
    source: z.enum(['calendar', 'mail', 'linear']),
    date: z.string().optional(),
  });
  const LoadIntegrationsRequestSchema = z.object({
    date: z.string().optional(),
  });

  ipcMain.handle(DAILY_REVIEW_CHANNELS.LOAD_INTEGRATION, async (_event, rawRequest) => {
    const request = LoadIntegrationRequestSchema.parse(rawRequest);
    return handleRequest(async () => dailyReviewUseCases.loadIntegration.execute(request), {
      channel: DAILY_REVIEW_CHANNELS.LOAD_INTEGRATION,
      source: request.source,
    });
  });

  ipcMain.handle(DAILY_REVIEW_CHANNELS.LOAD_INTEGRATIONS, async (_event, rawRequest) => {
    const request = LoadIntegrationsRequestSchema.parse(rawRequest ?? {});
    return handleRequest(async () => dailyReviewUseCases.loadIntegrations.execute(request), {
      channel: DAILY_REVIEW_CHANNELS.LOAD_INTEGRATIONS,
      date: request.date,
    });
  });

  ipcMain.handle(DAILY_REVIEW_CHANNELS.LIST_CALENDARS, async () =>
    handleRequest(async () => dailyReviewUseCases.listCalendars.execute(), {
      channel: DAILY_REVIEW_CHANNELS.LIST_CALENDARS,
    }),
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
