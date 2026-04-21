/**
 * QuickNote IPC Adapter - Handles slot-based quick-note IPC channels
 */

import { ipcMain } from 'electron';
import { QUICK_NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import type { IQuickNoteUseCases, QuickNoteSlot } from '@domain';
import { logger } from '../../../shared';

export interface QuickNoteIPCDeps {
  quickNoteUseCases: IQuickNoteUseCases;
}

export function registerQuickNoteHandlers(deps: QuickNoteIPCDeps): void {
  const { quickNoteUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'QuickNoteIPC',
      defaultCode: 'QUICK_NOTE_ERROR',
      context,
    });

  ipcMain.handle(
    QUICK_NOTE_CHANNELS.CREATE_IN_SLOT,
    async (_, request: { slot: QuickNoteSlot; title?: string; workspaceId?: string }) => {
      return handleRequest(
        () => quickNoteUseCases.createInSlot(request),
        { channel: QUICK_NOTE_CHANNELS.CREATE_IN_SLOT, slot: request.slot },
      );
    },
  );

  logger.info('[IPC] QuickNote handlers registered');
}

export function unregisterQuickNoteHandlers(): void {
  ipcMain.removeHandler(QUICK_NOTE_CHANNELS.CREATE_IN_SLOT);
}
