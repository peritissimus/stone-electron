import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Effect } from 'effect';
import {
  CreateNoteRequestSchema,
  DeleteNoteRequestSchema,
  GetAllNotesRequestSchema,
  GetNoteRequestSchema,
  UpdateNoteRequestSchema,
} from '@shared/schemas';
import type { INoteUseCases } from '../../../domain';
import type { NoteProps } from '../../../domain';

interface NoteHTTPDeps {
  runNoteEffect: <A, E>(use: (service: INoteUseCases) => Effect.Effect<A, E>) => Promise<A>;
}

type Query = Record<string, string | string[] | undefined>;

const toWireNote = (note: NoteProps) => ({
  ...note,
  embedding: null,
});

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const optionalInteger = (
  value: string | string[] | undefined,
  maximum: number,
): number | undefined => {
  const raw = first(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > maximum) {
    const error = new Error(`Expected an integer between 0 and ${maximum}`);
    error.name = 'SchemaParseError';
    throw error;
  }
  return parsed;
};

const errorStatus = (error: unknown): number => {
  if (!(error instanceof Error)) return 500;
  if (error.name === 'SchemaParseError' || error.name === 'NoteValidationError') {
    return 400;
  }
  if (error.name === 'NoteNotFoundError') return 404;
  return 500;
};

const sendError = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  const statusCode = errorStatus(error);
  if (statusCode >= 500) {
    request.log.error({ err: error }, 'Notes request failed');
  }
  const message =
    statusCode >= 500
      ? 'An unexpected server error occurred'
      : error instanceof Error
        ? error.message
        : 'Request failed';
  return reply.status(statusCode).send({
    error: {
      code:
        statusCode === 404
          ? 'NOTE_NOT_FOUND'
          : statusCode === 400
            ? 'VALIDATION_ERROR'
            : 'INTERNAL_ERROR',
      message,
    },
  });
};

/**
 * HTTP inbound adapter for note use cases.
 *
 * Routes validate and translate HTTP input, then call the inbound port through
 * runNoteEffect. They never reach into repositories or infrastructure.
 */
export class NoteHTTP {
  constructor(private readonly deps: NoteHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/health', async () => ({
      status: 'ok',
      service: 'stone-notes',
    }));

    app.get('/api/notes', async (request, reply) => {
      try {
        const query = request.query as Query;
        const parsed = GetAllNotesRequestSchema.parse({
          workspaceId: first(query.workspaceId),
          notebookId: first(query.notebookId),
          limit: optionalInteger(query.limit, 200),
          offset: optionalInteger(query.offset, 1_000_000),
          sortBy: first(query.sortBy),
          sortOrder: first(query.sortOrder),
        });
        const filter = first(query.filter);
        const result = await this.deps.runNoteEffect((notes) =>
          notes.listNotes.execute({
            workspaceId: parsed.workspaceId,
            notebookId: parsed.notebookId,
            filter:
              filter === 'favorites' ||
              filter === 'pinned' ||
              filter === 'archived' ||
              filter === 'trash'
                ? filter
                : 'all',
            limit: parsed.limit,
            offset: parsed.offset,
            orderBy:
              parsed.sortBy === 'createdAt' ||
              parsed.sortBy === 'title' ||
              parsed.sortBy === 'updatedAt'
                ? parsed.sortBy
                : 'updatedAt',
            orderDirection: parsed.sortOrder,
          }),
        );
        return reply.send({
          ...result,
          notes: result.notes.map(toWireNote),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/search', async (request, reply) => {
      try {
        const query = request.query as Query;
        const text = first(query.query)?.trim() ?? '';
        const limit = optionalInteger(query.limit, 200);
        const result = await this.deps.runNoteEffect((notes) =>
          notes.searchNotes.execute({
            query: text,
            workspaceId: first(query.workspaceId),
            limit,
          }),
        );
        return reply.send({
          results: result.notes.map((note) => ({
            id: note.id,
            title: note.title ?? '',
            notebookId: note.notebookId ?? null,
            score: 1,
            search_type: 'fts',
          })),
          total: result.total,
          query_time_ms: 0,
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/notes/:id', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const result = await this.deps.runNoteEffect((notes) =>
          notes.getNote.execute({ id, includeContent: true }),
        );
        return reply.send({
          ...result,
          note: toWireNote(result.note),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/notes/:id/content', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const result = await this.deps.runNoteEffect((notes) =>
          notes.getNoteContent.execute({ id }),
        );
        return reply.send(result);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes', async (request, reply) => {
      try {
        const parsed = CreateNoteRequestSchema.parse(request.body);
        const result = await this.deps.runNoteEffect((notes) => notes.createNote.execute(parsed));
        return reply.status(201).send(toWireNote(result.note));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.patch('/api/notes/:id', async (request, reply) => {
      try {
        const params = GetNoteRequestSchema.parse(request.params);
        const parsed = UpdateNoteRequestSchema.parse({
          ...(request.body as Record<string, unknown> | undefined),
          id: params.id,
        });
        const result = await this.deps.runNoteEffect((notes) =>
          notes.updateNote.execute({
            id: parsed.id,
            title: parsed.title,
            content: parsed.content,
            notebookId: parsed.notebookId,
          }),
        );
        return reply.send(toWireNote(result.note));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:id/favorite', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const result = await this.deps.runNoteEffect((notes) =>
          notes.toggleFavorite.execute({ id }),
        );
        return reply.send(toWireNote(result.note));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:id/pin', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const result = await this.deps.runNoteEffect((notes) => notes.togglePin.execute({ id }));
        return reply.send(toWireNote(result.note));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:id/archive', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const result = await this.deps.runNoteEffect((notes) =>
          notes.toggleArchive.execute({ id }),
        );
        return reply.send(toWireNote(result.note));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:id/move', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const targetNotebookId =
          (request.body as { targetNotebookId?: string | null } | undefined)?.targetNotebookId ??
          null;
        await this.deps.runNoteEffect((notes) => notes.moveNote.execute({ id, targetNotebookId }));
        const result = await this.deps.runNoteEffect((notes) => notes.getNote.execute({ id }));
        return reply.send(toWireNote(result.note));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.delete('/api/notes/:id', async (request, reply) => {
      try {
        const query = request.query as Query;
        const params = GetNoteRequestSchema.parse(request.params);
        const parsed = DeleteNoteRequestSchema.parse({
          id: params.id,
          permanent: first(query.permanent) === 'true',
        });
        await this.deps.runNoteEffect((notes) => notes.deleteNote.execute(parsed));
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });
  }
}
