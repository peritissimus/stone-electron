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
import type { Effect } from 'effect';
import { NOTE_CHANNELS } from '@shared/constants/ipcChannels';
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
import { COMMON_IPC_ERROR_MAP, handleIpcRequest } from '@main/shared/utils';

export interface NoteIPCDeps {
  runNoteEffect: RunNoteEffect;
}

export type RunNoteEffect = <A, E>(
  use: (service: INoteUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

function noteErrorCode(error: unknown): string {
  if (error instanceof Error) {
    switch (error.name) {
      case 'NoteNotFoundError':
        return 'NOTE_NOT_FOUND';
      case 'NoteNotEditableError':
        return 'NOTE_NOT_EDITABLE';
      case 'NoteValidationError':
        return 'VALIDATION_ERROR';
      default:
        return COMMON_IPC_ERROR_MAP[error.name] ?? 'INTERNAL_ERROR';
    }
  }
  return 'UNKNOWN_ERROR';
}

export function registerNoteHandlers(deps: NoteIPCDeps): void {
  const run = deps.runNoteEffect;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, {
      loggerPrefix: 'NoteIPC',
      defaultCode: 'INTERNAL_ERROR',
      mapErrorCode: noteErrorCode,
      context,
    });

  ipcMain.handle(NOTE_CHANNELS.CREATE, async (_event, rawRequest) => {
    const request = CreateNoteRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        const result = await run((service) =>
          service.createNote.execute(request),
        );
        return result.note;
      },
      { channel: NOTE_CHANNELS.CREATE, requestId: request.id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.GET, async (_event, rawRequest) => {
    const { id } = GetNoteRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        const result = await run((service) =>
          service.getNote.execute({ id, includeContent: true }),
        );
        return result.note;
      },
      { channel: NOTE_CHANNELS.GET, noteId: id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.GET_CONTENT, async (_event, rawRequest) => {
    const { id } = GetNoteContentRequestSchema.parse(rawRequest);
    return handleRequest<GetNoteContentResponse>(
      async () => {
        const result = await run((service) =>
          service.getNoteContent.execute({ id }),
        );
        return { content: result.content };
      },
      { channel: NOTE_CHANNELS.GET_CONTENT, noteId: id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.UPDATE, async (_event, rawRequest) => {
    const request = UpdateNoteRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        if (request.content !== undefined) {
          await run((service) =>
            service.saveNoteContent.execute({
              id: request.id,
              content: request.content!,
            }),
          );
        }
        const result = await run((service) =>
          service.updateNote.execute(request),
        );
        return result.note;
      },
      { channel: NOTE_CHANNELS.UPDATE, noteId: request.id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.DELETE, async (_event, rawRequest) => {
    const { id, permanent } = DeleteNoteRequestSchema.parse(rawRequest);
    return handleRequest<void>(
      async () => {
        await run((service) =>
          service.deleteNote.execute({ id, permanent }),
        );
      },
      { channel: NOTE_CHANNELS.DELETE, noteId: id, permanent },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.GET_ALL, async (_event, rawRequest) => {
    // GET_ALL accepts undefined (no filters) as well as a partial filter
    // object; fall back to empty before parsing.
    const request = GetAllNotesRequestSchema.parse(rawRequest ?? {});
    return handleRequest<GetAllNotesResponse>(
      async () => {
        return await run((service) => service.listNotes.execute(request));
      },
      { channel: NOTE_CHANNELS.GET_ALL },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.MOVE, async (_event, rawRequest) => {
    const { id, targetPath, targetNotebookId } = MoveNoteRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        await run((service) =>
          service.moveNote.execute({
            id,
            targetNotebookId: targetNotebookId ?? targetPath ?? null,
          }),
        );
        const result = await run((service) =>
          service.getNote.execute({ id, includeContent: false }),
        );
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
    return handleRequest<NoteResponse>(
      async () => {
        const result = await run((service) =>
          service.getNoteByPath.execute({
            filePath: filePath ?? path ?? '',
          }),
        );
        return result.note;
      },
      { channel: NOTE_CHANNELS.GET_BY_PATH, filePath: filePath ?? path },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.FAVORITE, async (_event, rawRequest) => {
    const { id } = ToggleFlagRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        const result = await run((service) =>
          service.toggleFavorite.execute({ id }),
        );
        return result.note;
      },
      { channel: NOTE_CHANNELS.FAVORITE, noteId: id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.PIN, async (_event, rawRequest) => {
    const { id } = ToggleFlagRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        const result = await run((service) =>
          service.togglePin.execute({ id }),
        );
        return result.note;
      },
      { channel: NOTE_CHANNELS.PIN, noteId: id },
    );
  });

  ipcMain.handle(NOTE_CHANNELS.ARCHIVE, async (_event, rawRequest) => {
    const { id } = ToggleFlagRequestSchema.parse(rawRequest);
    return handleRequest<NoteResponse>(
      async () => {
        const result = await run((service) =>
          service.toggleArchive.execute({ id }),
        );
        return result.note;
      },
      { channel: NOTE_CHANNELS.ARCHIVE, noteId: id },
    );
  });

  logger.info('[NoteIPC] Handlers registered');
}

export function unregisterNoteHandlers(): void {
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
