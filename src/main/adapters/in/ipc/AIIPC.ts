/**
 * AI IPC Adapter
 *
 * Exposes LLM-assisted PKM use cases to the renderer. Provider/API-key details
 * stay behind outbound adapters in the main process.
 */

import { ipcMain } from 'electron';
import { AI_CHANNELS } from '@shared/constants/ipcChannels';
import type { IAIUseCases } from '../../../domain';
import { handleIpcRequest, logger } from '@main/shared/utils';

export interface AIIPCDeps {
  aiUseCases: IAIUseCases;
}

export function registerAIHandlers(deps: AIIPCDeps): void {
  const { aiUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'AIIPC',
      defaultCode: 'AI_ERROR',
      context,
    });

  ipcMain.handle(AI_CHANNELS.ASK_NOTES, async (_event, request) =>
    handleRequest(
      async () => {
        const result = await aiUseCases.askNotes.execute(request);
        logger.info('[AIIPC.askNotes] done', {
          query: request?.query,
          workspaceId: request?.workspaceId,
          answerLength: result.answer.length,
          sourceCount: result.sources.length,
        });
        return result;
      },
      { channel: AI_CHANNELS.ASK_NOTES, query: request?.query, workspaceId: request?.workspaceId },
    ),
  );

  ipcMain.handle(AI_CHANNELS.SUMMARIZE_NOTE, async (_event, request) =>
    handleRequest(
      async () => aiUseCases.summarizeNote.execute(request),
      { channel: AI_CHANNELS.SUMMARIZE_NOTE, noteId: request?.noteId },
    ),
  );

  ipcMain.handle(AI_CHANNELS.SUGGEST_LINKS, async (_event, request) =>
    handleRequest(
      async () => aiUseCases.suggestLinks.execute(request),
      { channel: AI_CHANNELS.SUGGEST_LINKS, noteId: request?.noteId },
    ),
  );

  ipcMain.handle(AI_CHANNELS.WARM_TRANSCRIBER, async () =>
    handleRequest(
      async () => aiUseCases.warmUpTranscriber.execute(),
      { channel: AI_CHANNELS.WARM_TRANSCRIBER },
    ),
  );
}

export function unregisterAIHandlers(): void {
  Object.values(AI_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
