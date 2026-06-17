/**
 * Daily Review API — thin IPC wrapper.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { DAILY_REVIEW_CHANNELS } from '@shared/constants/ipcChannels';
import type { DailyReviewSnapshot, IpcResponse } from '@shared/types';

export interface DailyReviewSummary {
  summary: string;
  journalNoteId: string | null;
}

export const dailyReviewAPI = {
  get: (input?: {
    workspaceId?: string;
    date?: string;
  }): Promise<IpcResponse<DailyReviewSnapshot>> =>
    invokeIpc(DAILY_REVIEW_CHANNELS.GET, input ?? {}),

  summarize: (input?: {
    workspaceId?: string;
    date?: string;
    saveToJournal?: boolean;
  }): Promise<IpcResponse<DailyReviewSummary>> =>
    invokeIpc(DAILY_REVIEW_CHANNELS.SUMMARIZE, input ?? {}),
};
