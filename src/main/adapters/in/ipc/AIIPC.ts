/**
 * AI IPC Adapter
 *
 * Exposes LLM-assisted PKM use cases to the renderer. Provider/API-key details
 * stay behind outbound adapters in the main process.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { AI_CHANNELS } from '@shared/constants/ipcChannels';
import {
  AskNotesRequestSchema,
  NoteIdRequestSchema,
  NoteIdWithLimitRequestSchema,
} from '@shared/schemas';
import type { IAIUseCases } from '../../../domain';
import { handleIpcRequest, logger } from '@main/shared/utils';

export interface AIIPCDeps {
  runAIEffect: RunAIEffect;
}

export type RunAIEffect = <A, E>(
  use: (service: IAIUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerAIHandlers(deps: AIIPCDeps): void {
  const run = deps.runAIEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'AIIPC',
      defaultCode: 'AI_ERROR',
      context,
    });

  ipcMain.handle(AI_CHANNELS.ASK_NOTES, async (_event, rawRequest) =>
    handleRequest(
      async () => {
        const request = AskNotesRequestSchema.parse(rawRequest);
        const result = await run((service) =>
          service.askNotes.execute(request),
        );
        logger.info('[AIIPC.askNotes] done', {
          query: request?.query,
          workspaceId: request?.workspaceId,
          answerLength: result.answer.length,
          sourceCount: result.sources.length,
        });
        return result;
      },
      { channel: AI_CHANNELS.ASK_NOTES },
    ),
  );

  ipcMain.handle(AI_CHANNELS.SUMMARIZE_NOTE, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        run((service) =>
          service.summarizeNote.execute(
            NoteIdRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: AI_CHANNELS.SUMMARIZE_NOTE },
    ),
  );

  ipcMain.handle(AI_CHANNELS.SUGGEST_LINKS, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        run((service) =>
          service.suggestLinks.execute(
            NoteIdWithLimitRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: AI_CHANNELS.SUGGEST_LINKS },
    ),
  );
}

export function unregisterAIHandlers(): void {
  Object.values(AI_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
