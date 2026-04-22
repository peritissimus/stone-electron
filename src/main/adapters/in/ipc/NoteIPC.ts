/**
 * Note IPC Adapter
 *
 * Primary adapter that handles Electron IPC calls for note operations.
 *
 * Every handler:
 *   1. Parses its request payload via the shared request schema — catches
 *      malformed renderer input at the boundary with a typed error.
 *   2. Binds its response via a `handleRequest<ResponseType>` annotation,
 *      so a drift between the use case's return and the renderer's
 *      expected wire shape is a compile-time error.
 */

import { ipcMain } from 'electron';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
import { generateId } from '@shared/utils/id';
import {
  CreateNoteRequestSchema,
  DeleteNoteRequestSchema,
  GetAllNotesRequestSchema,
  GetNoteByPathRequestSchema,
  GetNoteContentRequestSchema,
  GetNoteRequestSchema,
  MoveNoteRequestSchema,
  ToggleFlagRequestSchema,
  UpdateNoteRequestSchema,
  type GetAllNotesResponse,
  type GetNoteContentResponse,
  type NoteResponse,
} from '@shared/schemas';
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

    ipcMain.handle(NOTE_CHANNELS.CREATE, async (_event, rawRequest) => {
      const { id, ...rest } = CreateNoteRequestSchema.parse(rawRequest);
      // ICreateNoteUseCase requires a string id; generate one if the caller
      // didn't supply one.
      const resolvedId = id ?? generateId();
      return this.handleRequest<NoteResponse>(
        async () => {
          const result = await noteUseCases.createNote.execute({ id: resolvedId, ...rest });
          return result.note;
        },
        { channel: NOTE_CHANNELS.CREATE, requestId: resolvedId },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.GET, async (_event, rawRequest) => {
      const { id } = GetNoteRequestSchema.parse(rawRequest);
      return this.handleRequest<NoteResponse>(
        async () => {
          const result = await noteUseCases.getNote.execute({ id, includeContent: true });
          return result.note;
        },
        { channel: NOTE_CHANNELS.GET, noteId: id },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.GET_CONTENT, async (_event, rawRequest) => {
      const { id } = GetNoteContentRequestSchema.parse(rawRequest);
      return this.handleRequest<GetNoteContentResponse>(
        async () => {
          const result = await noteUseCases.getNoteContent.execute({ id });
          return { content: result.content };
        },
        { channel: NOTE_CHANNELS.GET_CONTENT, noteId: id },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.UPDATE, async (_event, rawRequest) => {
      const request = UpdateNoteRequestSchema.parse(rawRequest);
      return this.handleRequest<NoteResponse>(
        async () => {
          if (request.content !== undefined) {
            await noteUseCases.saveNoteContent.execute({
              id: request.id,
              content: request.content,
            });
          }
          const result = await noteUseCases.updateNote.execute(request);
          return result.note;
        },
        { channel: NOTE_CHANNELS.UPDATE, noteId: request.id },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.DELETE, async (_event, rawRequest) => {
      const { id, permanent } = DeleteNoteRequestSchema.parse(rawRequest);
      return this.handleRequest<void>(
        async () => {
          await noteUseCases.deleteNote.execute({ id, permanent });
        },
        { channel: NOTE_CHANNELS.DELETE, noteId: id, permanent },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.GET_ALL, async (_event, rawRequest) => {
      // GET_ALL accepts undefined (no filters) as well as a partial filter
      // object; fall back to empty before parsing.
      const request = GetAllNotesRequestSchema.parse(rawRequest ?? {});
      return this.handleRequest<GetAllNotesResponse>(
        async () => {
          return await noteUseCases.listNotes.execute(request);
        },
        { channel: NOTE_CHANNELS.GET_ALL },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.MOVE, async (_event, rawRequest) => {
      const { id, targetPath, targetNotebookId } = MoveNoteRequestSchema.parse(rawRequest);
      return this.handleRequest<NoteResponse>(
        async () => {
          await noteUseCases.moveNote.execute({
            id,
            targetNotebookId: targetNotebookId ?? targetPath ?? null,
          });
          const result = await noteUseCases.getNote.execute({ id, includeContent: false });
          return result.note;
        },
        {
          channel: NOTE_CHANNELS.MOVE,
          noteId: id,
          targetNotebookId: targetNotebookId ?? targetPath ?? null,
        },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.GET_BY_PATH, async (_event, rawRequest) => {
      const { path, filePath } = GetNoteByPathRequestSchema.parse(rawRequest);
      return this.handleRequest<NoteResponse>(
        async () => {
          const result = await noteUseCases.getNoteByPath.execute({
            filePath: filePath ?? path ?? '',
          });
          return result.note;
        },
        { channel: NOTE_CHANNELS.GET_BY_PATH, filePath: filePath ?? path },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.FAVORITE, async (_event, rawRequest) => {
      const { id } = ToggleFlagRequestSchema.parse(rawRequest);
      return this.handleRequest<NoteResponse>(
        async () => {
          const result = await noteUseCases.toggleFavorite.execute({ id });
          return result.note;
        },
        { channel: NOTE_CHANNELS.FAVORITE, noteId: id },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.PIN, async (_event, rawRequest) => {
      const { id } = ToggleFlagRequestSchema.parse(rawRequest);
      return this.handleRequest<NoteResponse>(
        async () => {
          const result = await noteUseCases.togglePin.execute({ id });
          return result.note;
        },
        { channel: NOTE_CHANNELS.PIN, noteId: id },
      );
    });

    ipcMain.handle(NOTE_CHANNELS.ARCHIVE, async (_event, rawRequest) => {
      const { id } = ToggleFlagRequestSchema.parse(rawRequest);
      return this.handleRequest<NoteResponse>(
        async () => {
          const result = await noteUseCases.toggleArchive.execute({ id });
          return result.note;
        },
        { channel: NOTE_CHANNELS.ARCHIVE, noteId: id },
      );
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
        case 'ZodError':
          return 'VALIDATION_ERROR';
        default:
          return 'INTERNAL_ERROR';
      }
    }
    return 'UNKNOWN_ERROR';
  }
}
