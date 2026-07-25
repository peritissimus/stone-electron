/**
 * Status Report API — IPC wrapper for the weekly status generator.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { STATUS_REPORT_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import {
  StatusReportResultSchema,
  type StatusReportResult,
} from '@shared/schemas';
import { validateResponse } from './validation';

export type { StatusReportResult };

export const statusReportAPI = {
  generate: (input?: {
    workspaceId?: string;
    windowDays?: number;
    promptTemplate?: string;
  }): Promise<IpcResponse<StatusReportResult>> =>
    invokeIpc(STATUS_REPORT_CHANNELS.GENERATE, input ?? {}).then((response) =>
      validateResponse(response, StatusReportResultSchema),
    ),
};
