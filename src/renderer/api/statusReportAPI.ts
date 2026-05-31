/**
 * Status Report API — IPC wrapper for the weekly status generator.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { STATUS_REPORT_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';

export interface StatusReportResult {
  windowStart: string;
  windowEnd: string;
  evidence: {
    journalEntries: number;
    meetings: number;
    completedTasks: number;
    modifiedNotes: number;
  };
  report: string;
}

export const statusReportAPI = {
  generate: (input?: {
    workspaceId?: string;
    windowDays?: number;
    promptTemplate?: string;
  }): Promise<IpcResponse<StatusReportResult>> =>
    invokeIpc(STATUS_REPORT_CHANNELS.GENERATE, input ?? {}),
};
