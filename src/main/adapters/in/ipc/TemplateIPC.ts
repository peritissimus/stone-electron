/**
 * Template IPC Adapter — list + render templates.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { TEMPLATE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  CreateNoteFromTemplateRequestSchema,
  ListTemplatesRequestSchema,
} from '@shared/schemas';
import { handleIpcRequest } from '@main/shared/utils';
import type { ITemplateUseCases } from '../../../domain';

export interface TemplateIPCDeps {
  runTemplateEffect: RunTemplateEffect;
}

export type RunTemplateEffect = <A, E>(
  use: (service: ITemplateUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerTemplateHandlers(deps: TemplateIPCDeps): void {
  const run = deps.runTemplateEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'TemplateIPC', defaultCode: 'TEMPLATE_ERROR', context });

  ipcMain.handle(TEMPLATE_CHANNELS.LIST, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        run((service) =>
          service.listTemplates.execute(
            ListTemplatesRequestSchema.parse(rawRequest ?? {}),
          ),
        ),
      { channel: TEMPLATE_CHANNELS.LIST },
    ),
  );

  ipcMain.handle(TEMPLATE_CHANNELS.CREATE_NOTE_FROM_TEMPLATE, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        run((service) =>
          service.createNoteFromTemplate.execute(
            CreateNoteFromTemplateRequestSchema.parse(rawRequest),
          ),
        ),
      {
        channel: TEMPLATE_CHANNELS.CREATE_NOTE_FROM_TEMPLATE,
      },
    ),
  );
}

export function unregisterTemplateHandlers(): void {
  Object.values(TEMPLATE_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
