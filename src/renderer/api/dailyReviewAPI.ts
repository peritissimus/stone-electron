/**
 * Daily Review API — thin IPC wrapper.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { DAILY_REVIEW_CHANNELS } from '@shared/constants/ipcChannels';
import type {
  DailyReviewIntegrationOutcome,
  DailyReviewIntegrationsOutcome,
  DailyReviewIntegrationSource,
  DailyReviewSnapshot,
  ListDailyReviewCalendarsResult,
  IpcResponse,
} from '@shared/types';
import {
  DailyReviewIntegrationOutcomeSchema,
  DailyReviewIntegrationsOutcomeSchema,
  DailyReviewSnapshotSchema,
  DailyReviewSummarySchema,
  ListDailyReviewCalendarsResultSchema,
  type DailyReviewSummary,
} from '@shared/schemas';
import { validateResponse } from './validation';

export const dailyReviewAPI = {
  get: (input?: {
    workspaceId?: string;
    date?: string;
  }): Promise<IpcResponse<DailyReviewSnapshot>> =>
    invokeIpc(DAILY_REVIEW_CHANNELS.GET, input ?? {}).then((response) =>
      validateResponse(response, DailyReviewSnapshotSchema),
    ),

  listCalendars: (): Promise<IpcResponse<ListDailyReviewCalendarsResult>> =>
    invokeIpc(DAILY_REVIEW_CHANNELS.LIST_CALENDARS).then((response) =>
      validateResponse(response, ListDailyReviewCalendarsResultSchema),
    ),

  loadIntegration: (input: {
    source: DailyReviewIntegrationSource;
    date?: string;
  }): Promise<IpcResponse<DailyReviewIntegrationOutcome>> =>
    invokeIpc(DAILY_REVIEW_CHANNELS.LOAD_INTEGRATION, input).then((response) =>
      validateResponse(response, DailyReviewIntegrationOutcomeSchema),
    ),

  loadIntegrations: (input?: {
    date?: string;
  }): Promise<IpcResponse<DailyReviewIntegrationsOutcome>> =>
    invokeIpc(DAILY_REVIEW_CHANNELS.LOAD_INTEGRATIONS, input ?? {}).then((response) =>
      validateResponse(response, DailyReviewIntegrationsOutcomeSchema),
    ),

  summarize: (input?: {
    workspaceId?: string;
    date?: string;
    saveToJournal?: boolean;
  }): Promise<IpcResponse<DailyReviewSummary>> =>
    invokeIpc(DAILY_REVIEW_CHANNELS.SUMMARIZE, input ?? {}).then((response) =>
      validateResponse(response, DailyReviewSummarySchema),
    ),
};
