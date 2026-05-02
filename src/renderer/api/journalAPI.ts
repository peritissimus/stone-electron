/**
 * Journal API - IPC channel wrappers for the journal destination
 *
 * Thin wrappers around the journal IPC. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { JOURNAL_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import {
  ListJournalRangeResponseSchema,
  type ListJournalRangeRequest,
  type ListJournalRangeResponse,
  OpenOrCreateJournalResponseSchema,
  type OpenOrCreateJournalResponse,
} from '@shared/schemas';
import { validateResponse } from './validation';

export type { ListJournalRangeRequest, ListJournalRangeResponse, OpenOrCreateJournalResponse };

export const journalAPI = {
  /**
   * Resolve the journal note for a given date, creating it if it doesn't exist.
   * `date` should be an ISO date (YYYY-MM-DD) or full ISO timestamp.
   */
  openOrCreateForDate: async (
    date: string,
    workspaceId?: string,
  ): Promise<IpcResponse<OpenOrCreateJournalResponse>> => {
    const response = await invokeIpc(JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE, {
      date,
      workspaceId,
    });
    return validateResponse(response, OpenOrCreateJournalResponseSchema);
  },

  /**
   * Load a small metadata-only date window for the journal timeline.
   */
  listRange: async (
    request: ListJournalRangeRequest,
  ): Promise<IpcResponse<ListJournalRangeResponse>> => {
    const response = await invokeIpc(JOURNAL_CHANNELS.LIST_RANGE, request);
    return validateResponse(response, ListJournalRangeResponseSchema);
  },
};
