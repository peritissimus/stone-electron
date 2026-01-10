/**
 * Note IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for note operations.
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import type { INoteUseCases } from '../../../domain';
import { logger } from '../../../shared';
import { handleIpcRequest } from '@main/shared/utils';

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
      }, { channel: NOTE_CHANNELS.CREATE, requestId: request?.id });
    });

    ipcMain.handle(NOTE_CHANNELS.GET, async (_event, { id }: { id: string }) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.getNote.execute({ id, includeContent: true });
        return result.note;
      }, { channel: NOTE_CHANNELS.GET, noteId: id });
    });

    ipcMain.handle(NOTE_CHANNELS.GET_CONTENT, async (_event, { id }: { id: string }) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.getNoteContent.execute({ id });
        return { content: result.content };
      }, { channel: NOTE_CHANNELS.GET_CONTENT, noteId: id });
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
      }, { channel: NOTE_CHANNELS.UPDATE, noteId: request?.id });
    });

    ipcMain.handle(
      NOTE_CHANNELS.DELETE,
      async (_event, { id, permanent }: { id: string; permanent?: boolean }) => {
        return this.handleRequest(async () => {
          await noteUseCases.deleteNote.execute({ id, permanent });
          return { success: true };
        }, { channel: NOTE_CHANNELS.DELETE, noteId: id, permanent });
      },
    );

    ipcMain.handle(NOTE_CHANNELS.GET_ALL, async (_event, request) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.listNotes.execute(request || {});
        return result;
      }, { channel: NOTE_CHANNELS.GET_ALL });
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
        }, { channel: NOTE_CHANNELS.MOVE, noteId: id, targetNotebookId: targetNotebookId ?? targetPath ?? null });
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
        }, { channel: NOTE_CHANNELS.GET_BY_PATH, filePath: filePath ?? path });
      },
    );

    // notes:favorite - Toggle favorite status
    ipcMain.handle(
      NOTE_CHANNELS.FAVORITE,
      async (_event, { id }: { id: string; favorite?: boolean }) => {
        return this.handleRequest(async () => {
          const result = await noteUseCases.toggleFavorite.execute({ id });
          return result.note;
        }, { channel: NOTE_CHANNELS.FAVORITE, noteId: id });
      },
    );

    // notes:pin - Toggle pin status
    ipcMain.handle(NOTE_CHANNELS.PIN, async (_event, { id }: { id: string; pinned?: boolean }) => {
      return this.handleRequest(async () => {
        const result = await noteUseCases.togglePin.execute({ id });
        return result.note;
      }, { channel: NOTE_CHANNELS.PIN, noteId: id });
    });

    // notes:archive - Toggle archive status
    ipcMain.handle(
      NOTE_CHANNELS.ARCHIVE,
      async (_event, { id }: { id: string; archived?: boolean }) => {
        return this.handleRequest(async () => {
          const result = await noteUseCases.toggleArchive.execute({ id });
          return result.note;
        }, { channel: NOTE_CHANNELS.ARCHIVE, noteId: id });
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

  private async handleRequest<T>(
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<IPCResponse<T>> {
    return handleIpcRequest(fn, {
      loggerPrefix: 'NoteIPC',
      defaultCode: 'INTERNAL_ERROR',
      mapErrorCode: (error) => this.getErrorCode(error),
      context,
    });
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
