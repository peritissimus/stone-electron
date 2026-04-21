/**
 * QuickNote API - thin IPC wrapper for slot-based quick-note creation.
 * The backend owns the slot → folder mapping, so the renderer only knows
 * slot names ('personal' | 'work').
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { QUICK_NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import { validateResponse } from './validation';

export type QuickNoteSlot = 'personal' | 'work';

const CreateQuickNoteResponseSchema = z.object({
  noteId: z.string(),
});

export interface CreateQuickNoteResponse {
  noteId: string;
}

export const quickNoteAPI = {
  createInSlot: async (
    slot: QuickNoteSlot,
    title?: string,
  ): Promise<IpcResponse<CreateQuickNoteResponse>> => {
    const response = await invokeIpc(QUICK_NOTE_CHANNELS.CREATE_IN_SLOT, { slot, title });
    return validateResponse(response, CreateQuickNoteResponseSchema);
  },
};
