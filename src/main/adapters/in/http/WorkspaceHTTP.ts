import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Effect } from 'effect';
import type { IWorkspaceUseCases, WorkspaceProps } from '../../../domain';
import { sendError } from './httpError';

interface WorkspaceHTTPDeps {
  workspace: WorkspaceProps;
  runWorkspaceEffect: <A, E>(
    use: (service: IWorkspaceUseCases) => Effect.Effect<A, E>,
  ) => Promise<A>;
}

/** HTTP inbound adapter for the server-managed workspace. */
export class WorkspaceHTTP {
  constructor(private readonly deps: WorkspaceHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/workspace', async () => this.deps.workspace);

    app.post('/api/workspace/actions/select-folder', async () => ({
      canceled: false,
      folderPath: this.deps.workspace.folderPath,
    }));

    app.post('/api/workspace/actions/validate-path', async (request) => {
      const payload = (request.body as { path?: string; folderPath?: string } | undefined) ?? {};
      const candidate = payload.folderPath ?? payload.path ?? '';
      const expected = path.resolve(this.deps.workspace.folderPath);
      const valid = candidate.length > 0 && path.resolve(candidate) === expected;

      return {
        valid,
        ...(valid
          ? {}
          : { message: 'The web app uses the workspace configured on the Stone server.' }),
      };
    });

    // Folder paths are always relative to the workspace root; the use cases
    // resolve the active workspace themselves.
    app.post('/api/workspace/folders', async (request, reply) => {
      try {
        const body = (request.body as { name?: string; parentPath?: string } | undefined) ?? {};
        if (!body.name) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'name is required.' } });
        }
        const result = await this.deps.runWorkspaceEffect((service) =>
          service.createFolder.execute({
            name: body.name!,
            ...(body.parentPath ? { parentPath: body.parentPath } : {}),
          }),
        );
        return reply.status(201).send({ folderPath: result.path });
      } catch (error) {
        return sendError(request, reply, error, 'Workspace');
      }
    });

    app.patch('/api/workspace/folders', async (request, reply) => {
      try {
        const body = (request.body as { path?: string; name?: string } | undefined) ?? {};
        if (!body.path || !body.name) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'path and name are required.' } });
        }
        const result = await this.deps.runWorkspaceEffect((service) =>
          service.renameFolder.execute({ path: body.path!, name: body.name! }),
        );
        return reply.send({ folderPath: result.newPath });
      } catch (error) {
        return sendError(request, reply, error, 'Workspace');
      }
    });

    app.post('/api/workspace/folders/actions/move', async (request, reply) => {
      try {
        const body =
          (request.body as { sourcePath?: string; destinationPath?: string | null } | undefined) ??
          {};
        if (!body.sourcePath) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'sourcePath is required.' } });
        }
        const result = await this.deps.runWorkspaceEffect((service) =>
          service.moveFolder.execute({
            sourcePath: body.sourcePath!,
            destinationPath: body.destinationPath ?? null,
          }),
        );
        return reply.send({ folderPath: result.newPath });
      } catch (error) {
        return sendError(request, reply, error, 'Workspace');
      }
    });

    app.delete('/api/workspace/folders', async (request, reply) => {
      try {
        const query = request.query as { path?: string };
        const body = (request.body as { path?: string } | undefined) ?? {};
        const folderPath = body.path ?? query.path;
        if (!folderPath) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'path is required.' } });
        }
        await this.deps.runWorkspaceEffect((service) =>
          service.deleteFolder.execute({ path: folderPath }),
        );
        return reply.send({ success: true });
      } catch (error) {
        return sendError(request, reply, error, 'Workspace');
      }
    });
  }
}
