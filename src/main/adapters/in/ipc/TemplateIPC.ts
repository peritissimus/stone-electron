/**
 * Template IPC Adapter — list + render templates.
 */

import { ipcMain } from 'electron';
import { TEMPLATE_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import type { ITemplateUseCases } from '../../../domain';

export interface TemplateIPCDeps {
  templateUseCases: ITemplateUseCases;
}

export function registerTemplateHandlers(deps: TemplateIPCDeps): void {
  const { templateUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'TemplateIPC', defaultCode: 'TEMPLATE_ERROR', context });

  ipcMain.handle(TEMPLATE_CHANNELS.LIST, async (_event, request) =>
    handleRequest(
      async () => templateUseCases.listTemplates.execute({ workspaceId: request?.workspaceId }),
      { channel: TEMPLATE_CHANNELS.LIST, workspaceId: request?.workspaceId },
    ),
  );

  ipcMain.handle(TEMPLATE_CHANNELS.CREATE_NOTE_FROM_TEMPLATE, async (_event, request) =>
    handleRequest(
      async () =>
        templateUseCases.createNoteFromTemplate.execute({
          templateId: request.templateId,
          promptAnswers: request.promptAnswers,
          workspaceId: request?.workspaceId,
          destinationFolder: request?.destinationFolder,
        }),
      {
        channel: TEMPLATE_CHANNELS.CREATE_NOTE_FROM_TEMPLATE,
        templateId: request?.templateId,
      },
    ),
  );
}

export function unregisterTemplateHandlers(): void {
  Object.values(TEMPLATE_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
