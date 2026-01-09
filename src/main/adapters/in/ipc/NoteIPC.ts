/**
 * Note IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for note operations.
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { INoteUseCases } from '../../../domain/ports/in/INoteUseCases';
import { logger } from '../../../shared/utils/logger';

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

    ipcMain.handle(NOTE_CHANNELS.GET, async (_event, { id }: { id: string }) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.getNote.execute({ id, includeContent: true });
        return result.note;
      });
    });

    ipcMain.handle(NOTE_CHANNELS.GET_CONTENT, async (_event, { id }: { id: string }) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.getNoteContent.execute({ id });
        return { content: result.content };
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

    ipcMain.handle(
      NOTE_CHANNELS.DELETE,
      async (_event, { id, permanent }: { id: string; permanent?: boolean }) => {
        return this.handleRequest(async () => {
          await noteUseCases.deleteNote.execute({ id, permanent });
          return { success: true };
        });
      },
    );

    ipcMain.handle(NOTE_CHANNELS.GET_ALL, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.listNotes.execute(request || {});
        return result;
      });
    });

    ipcMain.handle(
      NOTE_CHANNELS.MOVE,
      async (
        _event,
        {
          id,
          targetPath,
          targetNotebookId,
        }: { id: string; targetPath?: string; targetNotebookId?: string | null },
      ) => {
        return this.handleRequest(async () => {
          // Frontend sends targetPath, use it as targetNotebookId if targetNotebookId not provided
          await noteUseCases.moveNote.execute({
            id,
            targetNotebookId: targetNotebookId ?? targetPath ?? null,
          });
          // Fetch and return the moved note
          const result = await noteUseCases.getNote.execute({ id, includeContent: false });
          return result.note;
        });
      },
    );

    // notes:getByPath - Get note by file path
    ipcMain.handle(
      NOTE_CHANNELS.GET_BY_PATH,
      async (_event, { path, filePath }: { path?: string; filePath?: string }) => {
        return this.handleRequest(async () => {
          const result = await noteUseCases.getNoteByPath.execute({
            filePath: filePath ?? path ?? '',
          });
          return result.note;
        });
      },
    );

    // notes:favorite - Toggle favorite status
    ipcMain.handle(
      NOTE_CHANNELS.FAVORITE,
      async (_event, { id }: { id: string; favorite?: boolean }) => {
        return this.handleRequest(async () => {
          const result = await noteUseCases.toggleFavorite.execute({ id });
          return result.note;
        });
      },
    );

    // notes:pin - Toggle pin status
    ipcMain.handle(NOTE_CHANNELS.PIN, async (_event, { id }: { id: string; pinned?: boolean }) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.togglePin.execute({ id });
        return result.note;
      });
    });

    // notes:archive - Toggle archive status
    ipcMain.handle(
      NOTE_CHANNELS.ARCHIVE,
      async (_event, { id }: { id: string; archived?: boolean }) => {
        return this.handleRequest(async () => {
          const result = await noteUseCases.toggleArchive.execute({ id });
          return result.note;
        });
      },
    );

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
    ipcMain.removeHandler(NOTE_CHANNELS.GET_BY_PATH);
    ipcMain.removeHandler(NOTE_CHANNELS.FAVORITE);
    ipcMain.removeHandler(NOTE_CHANNELS.PIN);
    ipcMain.removeHandler(NOTE_CHANNELS.ARCHIVE);
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
