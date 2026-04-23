/**
 * Scratch Editor API - open/read/write arbitrary .md files outside any
 * workspace. Pure IPC wrappers; no React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { SCRATCH_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import {
  ScratchPickResponseSchema,
  ScratchReadResponseSchema,
  ScratchWriteResponseSchema,
  type ScratchPickResponse,
  type ScratchReadResponse,
  type ScratchWriteResponse,
} from '@shared/schemas';
import { validateResponse } from './validation';

export type { ScratchPickResponse, ScratchReadResponse, ScratchWriteResponse };

export const scratchAPI = {
  pick: async (): Promise<IpcResponse<ScratchPickResponse>> => {
    const response = await invokeIpc(SCRATCH_CHANNELS.PICK);
    return validateResponse(response, ScratchPickResponseSchema);
  },

  read: async (path: string): Promise<IpcResponse<ScratchReadResponse>> => {
    const response = await invokeIpc(SCRATCH_CHANNELS.READ, { path });
    return validateResponse(response, ScratchReadResponseSchema);
  },

  write: async (path: string, content: string): Promise<IpcResponse<ScratchWriteResponse>> => {
    const response = await invokeIpc(SCRATCH_CHANNELS.WRITE, { path, content });
    return validateResponse(response, ScratchWriteResponseSchema);
  },
};
