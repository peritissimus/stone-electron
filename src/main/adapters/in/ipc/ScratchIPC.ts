/**
 * Scratch IPC Adapter - "Open any .md file" support for the editor.
 *
 * Scratch mode is intentionally outside the workspace/note pipeline: no
 * NoteEntity, no DB row, no event publishing, no file watcher reload — just
 * read a file by absolute path, render it in TipTap, and write the same
 * path back on save. This keeps the feature's blast radius tiny and means
 * it can never accidentally collide with the workspace sync paths.
 */

import { ipcMain } from 'electron';
import { SCRATCH_CHANNELS } from '@shared/constants/ipcChannels';
import {
  ScratchReadRequestSchema,
  ScratchWriteRequestSchema,
  type ScratchPickResponse,
  type ScratchReadResponse,
  type ScratchWriteResponse,
} from '@shared/schemas';
import type { IScratchUseCases } from '../../../domain/ports/in/IScratchUseCases';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';

export interface ScratchIPCDeps {
  scratchUseCases: IScratchUseCases;
}

export function registerScratchHandlers(deps: ScratchIPCDeps): void {
  const { scratchUseCases } = deps;

  ipcMain.handle(SCRATCH_CHANNELS.PICK, async () =>
    handleIpcRequest<ScratchPickResponse>(
      async () => scratchUseCases.pickScratchFile.execute(),
      {
        loggerPrefix: 'ScratchIPC',
        defaultCode: 'SCRATCH_PICK_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: { channel: SCRATCH_CHANNELS.PICK },
      },
    ),
  );

  ipcMain.handle(SCRATCH_CHANNELS.READ, async (_event, rawRequest) => {
    const request = ScratchReadRequestSchema.parse(rawRequest);
    return handleIpcRequest<ScratchReadResponse>(
      async () => scratchUseCases.readScratchFile.execute({ path: request.path }),
      {
        loggerPrefix: 'ScratchIPC',
        defaultCode: 'SCRATCH_READ_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: { channel: SCRATCH_CHANNELS.READ, path: request.path },
      },
    );
  });

  ipcMain.handle(SCRATCH_CHANNELS.WRITE, async (_event, rawRequest) => {
    const request = ScratchWriteRequestSchema.parse(rawRequest);
    return handleIpcRequest<ScratchWriteResponse>(
      async () =>
        scratchUseCases.writeScratchFile.execute({ path: request.path, content: request.content }),
      {
        loggerPrefix: 'ScratchIPC',
        defaultCode: 'SCRATCH_WRITE_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: {
          channel: SCRATCH_CHANNELS.WRITE,
          path: request.path,
          bytes: request.content.length,
        },
      },
    );
  });

  logger.info('[IPC] Scratch handlers registered');
}

export function unregisterScratchHandlers(): void {
  Object.values(SCRATCH_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
