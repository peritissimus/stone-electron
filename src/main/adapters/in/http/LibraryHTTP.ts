import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Effect } from 'effect';
import {
  AddTagToNoteRequestSchema,
  CreateNotebookRequestSchema,
  CreateTagRequestSchema,
  DeleteNotebookRequestSchema,
  DeleteTagRequestSchema,
  MoveNotebookRequestSchema,
  RemoveTagFromNoteRequestSchema,
  UpdateNotebookRequestSchema,
} from '@shared/schemas';
import type {
  INotebookUseCases,
  IQuickNoteUseCases,
  ITagUseCases,
  ITaskUseCases,
  TaskState,
} from '../../../domain';

interface LibraryHTTPDeps {
  workspaceId: string;
  runNotebookEffect: <A, E>(use: (service: INotebookUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runTagEffect: <A, E>(use: (service: ITagUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runTaskEffect: <A, E>(use: (service: ITaskUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runQuickNoteEffect: <A, E>(
    use: (service: IQuickNoteUseCases) => Effect.Effect<A, E>,
  ) => Promise<A>;
}

const sendError = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  const name = error instanceof Error ? error.name : '';
  const statusCode = name.includes('NotFound') ? 404 : name.includes('Validation') ? 400 : 500;
  if (statusCode === 500) request.log.error({ err: error }, 'Library request failed');
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

const withTagCount = (tag: Record<string, unknown>) => ({
  ...tag,
  note_count:
    typeof tag.noteCount === 'number'
      ? tag.noteCount
      : typeof tag.note_count === 'number'
        ? tag.note_count
        : 0,
});

/** HTTP inbound adapter for notebook and tag use cases. */
export class LibraryHTTP {
  constructor(private readonly deps: LibraryHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.post('/api/quick-notes', async (request, reply) => {
      try {
        const body = request.body as {
          slot?: 'personal' | 'work';
          title?: string;
          workspaceId?: string;
        };
        if (body.slot !== 'personal' && body.slot !== 'work') {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid quick-note slot',
            },
          });
        }
        const slot = body.slot;
        const result = await this.deps.runQuickNoteEffect((service) =>
          service.createInSlot({
            slot,
            title: body.title,
            workspaceId: body.workspaceId,
          }),
        );
        return reply.status(201).send(result);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/tasks', async (request, reply) => {
      try {
        const tasks = await this.deps.runTaskEffect((service) => service.getAllTasks.execute());
        return reply.send(
          tasks.map((task) => ({
            ...task,
            createdAt: task.createdAt.toISOString(),
            updatedAt: task.updatedAt.toISOString(),
          })),
        );
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.patch('/api/notes/:noteId/tasks/:taskIndex', async (request, reply) => {
      try {
        const params = request.params as { noteId: string; taskIndex: string };
        const taskIndex = Number(params.taskIndex);
        const newState = (request.body as { newState?: string }).newState as TaskState;
        if (!Number.isInteger(taskIndex) || taskIndex < 0 || !newState) {
          return reply.status(400).send({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid task update' },
          });
        }
        await this.deps.runTaskEffect((service) =>
          service.updateTaskState.execute(params.noteId, taskIndex, newState),
        );
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/notebooks', async (request, reply) => {
      try {
        const result = await this.deps.runNotebookEffect((service) =>
          service.listNotebooks.execute({
            workspaceId: this.deps.workspaceId,
            includeNoteCount: true,
          }),
        );
        return reply.send({
          notebooks: result.notebooks.map((notebook) => ({
            ...notebook,
            note_count: 'noteCount' in notebook ? notebook.noteCount : 0,
          })),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notebooks', async (request, reply) => {
      try {
        const parsed = CreateNotebookRequestSchema.parse(request.body);
        const result = await this.deps.runNotebookEffect((service) =>
          service.createNotebook.execute({
            name: parsed.name,
            parentId: parsed.parent_id,
            workspaceId: this.deps.workspaceId,
            icon: parsed.icon,
            color: parsed.color,
          }),
        );
        return reply.status(201).send(result.notebook);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.patch('/api/notebooks/:id', async (request, reply) => {
      try {
        const parsed = UpdateNotebookRequestSchema.parse({
          ...(request.body as Record<string, unknown>),
          ...(request.params as { id: string }),
        });
        const result = await this.deps.runNotebookEffect((service) =>
          service.updateNotebook.execute(parsed),
        );
        return reply.send(result.notebook);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notebooks/:id/move', async (request, reply) => {
      try {
        const parsed = MoveNotebookRequestSchema.parse({
          ...(request.body as Record<string, unknown>),
          ...(request.params as { id: string }),
        });
        await this.deps.runNotebookEffect((service) =>
          service.moveNotebook.execute({
            id: parsed.id,
            targetParentId: parsed.parent_id ?? null,
          }),
        );
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.delete('/api/notebooks/:id', async (request, reply) => {
      try {
        const parsed = DeleteNotebookRequestSchema.parse({
          ...(request.params as { id: string }),
          delete_notes: (request.query as { deleteNotes?: string }).deleteNotes === 'true',
        });
        await this.deps.runNotebookEffect((service) =>
          service.deleteNotebook.execute({
            id: parsed.id,
            deleteNotes: parsed.delete_notes,
          }),
        );
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/tags', async (request, reply) => {
      try {
        const result = await this.deps.runTagEffect((service) =>
          service.listTags.execute({ includeNoteCount: true }),
        );
        return reply.send({
          tags: result.tags.map((tag) => withTagCount(tag as unknown as Record<string, unknown>)),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/tags', async (request, reply) => {
      try {
        const parsed = CreateTagRequestSchema.parse(request.body);
        const result = await this.deps.runTagEffect((service) => service.createTag.execute(parsed));
        return reply.status(201).send(result.tag);
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.delete('/api/tags/:id', async (request, reply) => {
      try {
        const parsed = DeleteTagRequestSchema.parse(request.params);
        await this.deps.runTagEffect((service) => service.deleteTag.execute(parsed));
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:noteId/tags', async (request, reply) => {
      try {
        const parsed = AddTagToNoteRequestSchema.parse({
          ...(request.body as Record<string, unknown>),
          ...(request.params as { noteId: string }),
        });
        const tagIds = parsed.tagIds?.length ? parsed.tagIds : [parsed.tagId!];
        for (const tagId of tagIds) {
          await this.deps.runTagEffect((service) =>
            service.addTagToNote.execute({ noteId: parsed.noteId, tagId }),
          );
        }
        const result = await this.deps.runTagEffect((service) =>
          service.listTags.execute({ includeNoteCount: true }),
        );
        return reply.send({
          tags: result.tags.map((tag) => withTagCount(tag as unknown as Record<string, unknown>)),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.delete('/api/notes/:noteId/tags/:tagId', async (request, reply) => {
      try {
        const parsed = RemoveTagFromNoteRequestSchema.parse(request.params);
        await this.deps.runTagEffect((service) => service.removeTagFromNote.execute(parsed));
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });
  }
}
