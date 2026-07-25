/**
 * Daily Review IPC Adapter — exposes today's snapshot to the renderer.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { DAILY_REVIEW_CHANNELS } from '@shared/constants/ipcChannels';
import {
  LoadDailyReviewIntegrationRequestSchema,
  LoadDailyReviewIntegrationsRequestSchema,
} from '@shared/schemas';
import { handleIpcRequest } from '@main/shared/utils';
import type { IDailyReviewUseCases } from '../../../domain';

export interface DailyReviewIPCDeps {
  runDailyReviewEffect: RunDailyReviewEffect;
}

export type RunDailyReviewEffect = <A, E>(
  use: (service: IDailyReviewUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerDailyReviewHandlers(deps: DailyReviewIPCDeps): void {
  const { runDailyReviewEffect } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'DailyReviewIPC',
      defaultCode: 'DAILY_REVIEW_ERROR',
      context,
    });

  ipcMain.handle(DAILY_REVIEW_CHANNELS.GET, async (_event, request) =>
    handleRequest(
      async () =>
        runDailyReviewEffect((service) =>
          service.getDailyReview.execute({
            workspaceId: request?.workspaceId,
            date: request?.date,
          }),
        ),
      { channel: DAILY_REVIEW_CHANNELS.GET, date: request?.date },
    ),
  );

  ipcMain.handle(DAILY_REVIEW_CHANNELS.LOAD_INTEGRATION, async (_event, rawRequest) => {
    const request = LoadDailyReviewIntegrationRequestSchema.parse(rawRequest);
    return handleRequest(async () => runDailyReviewEffect((service) =>
      service.loadIntegration.execute(request),
    ), {
      channel: DAILY_REVIEW_CHANNELS.LOAD_INTEGRATION,
      source: request.source,
    });
  });

  ipcMain.handle(DAILY_REVIEW_CHANNELS.LOAD_INTEGRATIONS, async (_event, rawRequest) => {
    const request = LoadDailyReviewIntegrationsRequestSchema.parse(rawRequest ?? {});
    return handleRequest(async () => runDailyReviewEffect((service) =>
      service.loadIntegrations.execute(request),
    ), {
      channel: DAILY_REVIEW_CHANNELS.LOAD_INTEGRATIONS,
      date: request.date,
    });
  });

  ipcMain.handle(DAILY_REVIEW_CHANNELS.LIST_CALENDARS, async () =>
    handleRequest(async () => runDailyReviewEffect((service) =>
      service.listCalendars.execute(),
    ), {
      channel: DAILY_REVIEW_CHANNELS.LIST_CALENDARS,
    }),
  );

  ipcMain.handle(DAILY_REVIEW_CHANNELS.SUMMARIZE, async (_event, request) =>
    handleRequest(
      async () =>
        runDailyReviewEffect((service) =>
          service.summarizeDailyReview.execute({
            workspaceId: request?.workspaceId,
            date: request?.date,
            saveToJournal: request?.saveToJournal,
          }),
        ),
      { channel: DAILY_REVIEW_CHANNELS.SUMMARIZE, date: request?.date },
    ),
  );
}

export function unregisterDailyReviewHandlers(): void {
  Object.values(DAILY_REVIEW_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
