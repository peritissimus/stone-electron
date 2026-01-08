/**
 * Note IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for note operations.
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { INoteUseCases } from '../../../domain/ports/in/INoteUseCases';
import { logger } from '@main/utils/logger';

export interface NoteIPCDeps {
  noteUseCases: INoteUseCases;
}

interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class NoteIPC {
  constructor(private readonly deps: NoteIPCDeps) {}

  registerHandlers(): void {
    const { noteUseCases } = this.deps;

    ipcMain.handle(NOTE_CHANNELS.CREATE, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.createNote.execute(request);
        return result.note;
      });
    });

    ipcMain.handle(NOTE_CHANNELS.GET, async (_event, id: string) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.getNote.execute({ id, includeContent: false });
        return result.note;
      });
    });

    ipcMain.handle(NOTE_CHANNELS.GET_CONTENT, async (_event, id: string) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.getNoteContent.execute({ id });
        return result.content;
      });
    });

    ipcMain.handle(NOTE_CHANNELS.UPDATE, async (_event, request) => {
      return this.handleRequest(async () => {
        if (request.content !== undefined) {
          await noteUseCases.saveNoteContent.execute({
            id: request.id,
            content: request.content,
          });
        }
        const result = await noteUseCases.updateNote.execute(request);
        return result.note;
      });
    });

    ipcMain.handle(NOTE_CHANNELS.DELETE, async (_event, id: string, permanent?: boolean) => {
      return this.handleRequest(async () => {
        await noteUseCases.deleteNote.execute({ id, permanent });
        return { success: true };
      });
    });

    ipcMain.handle(NOTE_CHANNELS.GET_ALL, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.listNotes.execute(request || {});
        return result;
      });
    });

    ipcMain.handle(NOTE_CHANNELS.MOVE, async (_event, id: string, targetNotebookId: string | null) => {
      return this.handleRequest(async () => {
        await noteUseCases.moveNote.execute({ id, targetNotebookId });
        return { success: true };
      });
    });

    logger.info('[NoteIPC] Handlers registered');
  }

  unregisterHandlers(): void {
    ipcMain.removeHandler(NOTE_CHANNELS.CREATE);
    ipcMain.removeHandler(NOTE_CHANNELS.GET);
    ipcMain.removeHandler(NOTE_CHANNELS.GET_CONTENT);
    ipcMain.removeHandler(NOTE_CHANNELS.UPDATE);
    ipcMain.removeHandler(NOTE_CHANNELS.DELETE);
    ipcMain.removeHandler(NOTE_CHANNELS.GET_ALL);
    ipcMain.removeHandler(NOTE_CHANNELS.MOVE);
  }

  private async handleRequest<T>(fn: () => Promise<T>): Promise<IPCResponse<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const code = this.getErrorCode(error);
      logger.error('[NoteIPC] Error:', { code, message });
      return { success: false, error: { code, message } };
    }
  }

  private getErrorCode(error: unknown): string {
    if (error instanceof Error) {
      switch (error.name) {
        case 'NoteNotFoundError':
          return 'NOTE_NOT_FOUND';
        case 'NoteNotEditableError':
          return 'NOTE_NOT_EDITABLE';
        case 'NoteValidationError':
          return 'VALIDATION_ERROR';
        default:
          return 'INTERNAL_ERROR';
      }
    }
    return 'UNKNOWN_ERROR';
  }
}
