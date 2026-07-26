import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Effect } from 'effect';
import {
  GetGraphDataRequestSchema,
  GetNoteRequestSchema,
  ListJournalRangeRequestSchema,
  OpenOrCreateJournalRequestSchema,
  RestoreVersionRequestSchema,
} from '@shared/schemas';
import type {
  IGraphUseCases,
  IJournalUseCases,
  INoteUseCases,
  IVersionUseCases,
  NoteProps,
} from '../../../domain';

interface KnowledgeHTTPDeps {
  runNoteEffect: <A, E>(use: (service: INoteUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runGraphEffect: <A, E>(use: (service: IGraphUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runVersionEffect: <A, E>(use: (service: IVersionUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runJournalEffect: <A, E>(use: (service: IJournalUseCases) => Effect.Effect<A, E>) => Promise<A>;
}

const wireNote = (note: NoteProps) => ({ ...note, embedding: null });

const sendError = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  const name = error instanceof Error ? error.name : '';
  const statusCode = name.includes('NotFound') ? 404 : name.includes('Validation') ? 400 : 500;
  if (statusCode === 500) {
    request.log.error({ err: error }, 'Knowledge request failed');
  }
  return reply.status(statusCode).send({
    error: {
      code:
        statusCode === 404
          ? 'NOT_FOUND'
          : statusCode === 400
            ? 'VALIDATION_ERROR'
            : 'INTERNAL_ERROR',
      message:
        statusCode === 500
          ? 'An unexpected server error occurred'
          : error instanceof Error
            ? error.message
            : 'Request failed',
    },
  });
};

/** HTTP inbound adapter for graph, version-history, and journal use cases. */
export class KnowledgeHTTP {
  constructor(private readonly deps: KnowledgeHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/graph', async (request, reply) => {
      try {
        const query = request.query as Record<string, string | undefined>;
        const parsed = GetGraphDataRequestSchema.parse({
          centerNoteId: query.centerNoteId,
          depth: query.depth ? Number(query.depth) : undefined,
          includeOrphans:
            query.includeOrphans === undefined ? true : query.includeOrphans === 'true',
        });
        return reply.send(
          await this.deps.runGraphEffect((service) => service.getGraphData.execute(parsed)),
        );
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/notes/:id/backlinks', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const links = await this.deps.runGraphEffect((service) => service.getBacklinks.execute(id));
        const notes = await Promise.all(
          links.map((link) =>
            this.deps
              .runNoteEffect((service) => service.getNote.execute({ id: link.sourceId }))
              .then((result) => wireNote(result.note)),
          ),
        );
        return reply.send({ notes });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/notes/:id/forward-links', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const links = await this.deps.runGraphEffect((service) =>
          service.getForwardLinks.execute(id),
        );
        const notes = await Promise.all(
          links.map((link) =>
            this.deps
              .runNoteEffect((service) => service.getNote.execute({ id: link.targetId }))
              .then((result) => wireNote(result.note)),
          ),
        );
        return reply.send({ notes });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.put('/api/notes/:id/links', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const content = (request.body as { content?: string }).content ?? '';
        await this.deps.runGraphEffect((service) => service.updateNoteLinks.execute(id, content));
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/notes/:id/versions', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const versions = await this.deps.runVersionEffect((service) =>
          service.getVersions.execute(id),
        );
        return reply.send({
          versions: versions.map((version) => ({
            id: version.id,
            noteId: version.noteId,
            versionNumber: version.versionNumber,
            title: version.title,
            contentPreview: version.content.slice(0, 200),
            createdAt: version.createdAt.toISOString(),
            sizeBytes: new TextEncoder().encode(version.content).byteLength,
          })),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:id/versions', async (request, reply) => {
      try {
        const { id } = GetNoteRequestSchema.parse(request.params);
        const version = await this.deps.runVersionEffect((service) =>
          service.createVersion.execute(id),
        );
        return reply.status(201).send({
          ...version,
          createdAt: version.createdAt.toISOString(),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:id/versions/:versionId/restore', async (request, reply) => {
      try {
        const parsed = RestoreVersionRequestSchema.parse(request.params);
        await this.deps.runVersionEffect((service) =>
          service.restoreVersion.execute(parsed.id, parsed.versionId),
        );
        const result = await this.deps.runNoteEffect((service) =>
          service.getNote.execute({ id: parsed.id }),
        );
        return reply.send(wireNote(result.note));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/journals', async (request, reply) => {
      try {
        const query = request.query as Record<string, string | undefined>;
        const parsed = ListJournalRangeRequestSchema.parse({
          limit: query.limit ? Number(query.limit) : 14,
          workspaceId: query.workspaceId,
        });
        return reply.send(await this.deps.runJournalEffect((service) => service.listRange(parsed)));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/journals', async (request, reply) => {
      try {
        const parsed = OpenOrCreateJournalRequestSchema.parse(request.body);
        const result = await this.deps.runJournalEffect((service) =>
          service.openOrCreateForDate(parsed),
        );
        return reply.status(result.created ? 201 : 200).send(result);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });
  }
}
