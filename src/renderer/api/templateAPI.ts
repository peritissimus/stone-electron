/**
 * Template API — IPC wrappers for the templates feature.
 */

import {
  CreateFromTemplateResponseSchema,
  ListTemplatesResponseSchema,
} from '@shared/schemas';
import { invokeIpc } from '@renderer/lib/ipc';
import { TEMPLATE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse, Template } from '@shared/types';
import { validateResponse } from './validation';

export const templateAPI = {
  list: async (workspaceId?: string): Promise<IpcResponse<{ templates: Template[] }>> => {
    const response = await invokeIpc(TEMPLATE_CHANNELS.LIST, { workspaceId });
    return validateResponse(response, ListTemplatesResponseSchema);
  },

  createNoteFromTemplate: async (
    templateId: string,
    promptAnswers?: Record<string, string>,
    workspaceId?: string,
  ): Promise<IpcResponse<{ noteId: string; cursorOffset: number | null }>> => {
    const response = await invokeIpc(TEMPLATE_CHANNELS.CREATE_NOTE_FROM_TEMPLATE, {
      templateId,
      promptAnswers,
      workspaceId,
    });
    return validateResponse(response, CreateFromTemplateResponseSchema);
  },
};
