/**
 * Template API — IPC wrappers for the templates feature.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { TEMPLATE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse, Template } from '@shared/types';
import { validateResponse } from './validation';

const TemplateSchema: z.ZodType<Template> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  body: z.string(),
  prompts: z.array(z.string()),
});

const ListResponseSchema = z.object({
  templates: z.array(TemplateSchema),
});

const CreateResponseSchema = z.object({
  noteId: z.string(),
  cursorOffset: z.number().nullable(),
});

export const templateAPI = {
  list: async (workspaceId?: string): Promise<IpcResponse<{ templates: Template[] }>> => {
    const response = await invokeIpc(TEMPLATE_CHANNELS.LIST, { workspaceId });
    return validateResponse(response, ListResponseSchema);
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
    return validateResponse(response, CreateResponseSchema);
  },
};
