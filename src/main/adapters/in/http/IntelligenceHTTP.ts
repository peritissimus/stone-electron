import type { FastifyInstance } from 'fastify';
import type { Effect } from 'effect';
import type { IAIUseCases, IIndexUseCases, ITopicUseCases } from '../../../domain';
import { sendError } from './httpError';

interface IntelligenceHTTPDeps {
  workspaceId: string;
  runTopicEffect: <A, E>(use: (service: ITopicUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runIndexEffect: <A, E>(use: (service: IIndexUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runAIEffect: <A, E>(use: (service: IAIUseCases) => Effect.Effect<A, E>) => Promise<A>;
}

const positiveInt = (value: unknown): number | undefined => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

/** HTTP inbound adapter for embeddings, topic search, and AI over notes. */
export class IntelligenceHTTP {
  constructor(private readonly deps: IntelligenceHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/topics/embedding-status', async (request, reply) => {
      try {
        return reply.send(
          await this.deps.runTopicEffect((service) => service.getEmbeddingStatus.execute()),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Topic');
      }
    });

    app.post('/api/topics/actions/initialize', async (request, reply) => {
      try {
        return reply.send(
          await this.deps.runTopicEffect((service) => service.initialize.execute()),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Topic');
      }
    });

    app.post('/api/topics/actions/semantic-search', async (request, reply) => {
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        if (typeof body.query !== 'string' || !body.query.trim()) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'query is required.' } });
        }
        const limit = positiveInt(body.limit);
        const results = await this.deps.runTopicEffect((service) =>
          service.semanticSearch.execute(body.query as string, limit),
        );
        // The renderer's schema expects the list under `results`.
        return reply.send({ results });
      } catch (error) {
        return sendError(request, reply, error, 'Topic');
      }
    });

    app.get('/api/index/stats', async (request, reply) => {
      try {
        const query = request.query as { workspaceId?: string };
        return reply.send(
          await this.deps.runIndexEffect((service) =>
            service.getStats.execute({
              workspaceId: query.workspaceId ?? this.deps.workspaceId,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Index');
      }
    });

    app.post('/api/index/actions/index-note', async (request, reply) => {
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        if (typeof body.noteId !== 'string') {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'noteId is required.' } });
        }
        return reply.send(
          await this.deps.runIndexEffect((service) =>
            service.indexNote.execute({
              noteId: body.noteId as string,
              force: body.force === true,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Index');
      }
    });

    app.post('/api/index/actions/rebuild', async (request, reply) => {
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        return reply.send(
          await this.deps.runIndexEffect((service) =>
            service.rebuildAll.execute({
              workspaceId:
                typeof body.workspaceId === 'string' ? body.workspaceId : this.deps.workspaceId,
              force: body.force === true,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Index');
      }
    });

    app.post('/api/ai/actions/ask-notes', async (request, reply) => {
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        if (typeof body.query !== 'string' || !body.query.trim()) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'query is required.' } });
        }
        const limit = positiveInt(body.limit);
        return reply.send(
          await this.deps.runAIEffect((service) =>
            service.askNotes.execute({
              query: body.query as string,
              workspaceId:
                typeof body.workspaceId === 'string' ? body.workspaceId : this.deps.workspaceId,
              ...(limit ? { limit } : {}),
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'AI');
      }
    });

    app.post('/api/notes/:id/ai/summarize', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        return reply.send(
          await this.deps.runAIEffect((service) =>
            service.summarizeNote.execute({ noteId: params.id }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'AI');
      }
    });

    app.post('/api/notes/:id/ai/suggest-links', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        const limit = positiveInt(body.limit);
        return reply.send(
          await this.deps.runAIEffect((service) =>
            service.suggestLinks.execute({
              noteId: params.id,
              ...(limit ? { limit } : {}),
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'AI');
      }
    });
  }
}
