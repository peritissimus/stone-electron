/**
 * QuickNote IPC Adapter - Handles slot-based quick-note IPC channels
 */

import { ipcMain } from 'electron';
import { QUICK_NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import {
  CreateQuickNoteRequestSchema,
  type CreateQuickNoteResponse,
} from '@shared/schemas';
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';
import type { IQuickNoteUseCases } from '@domain';
import { logger } from '../../../shared';

export interface QuickNoteIPCDeps {
  quickNoteUseCases: IQuickNoteUseCases;
}

export function registerQuickNoteHandlers(deps: QuickNoteIPCDeps): void {
  const { quickNoteUseCases } = deps;

  ipcMain.handle(QUICK_NOTE_CHANNELS.CREATE_IN_SLOT, async (_event, rawRequest) => {
    const request = CreateQuickNoteRequestSchema.parse(rawRequest);
    return handleIpcRequest<CreateQuickNoteResponse>(
      () => quickNoteUseCases.createInSlot(request),
      {
        loggerPrefix: 'QuickNoteIPC',
        defaultCode: 'QUICK_NOTE_ERROR',
        errorMap: { ...COMMON_IPC_ERROR_MAP },
        context: { channel: QUICK_NOTE_CHANNELS.CREATE_IN_SLOT, slot: request.slot },
      },
    );
  });

  logger.info('[IPC] QuickNote handlers registered');
}

export function unregisterQuickNoteHandlers(): void {
  ipcMain.removeHandler(QUICK_NOTE_CHANNELS.CREATE_IN_SLOT);
}
