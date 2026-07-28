import type { FastifyInstance } from 'fastify';
import type { Effect } from 'effect';
import type { IGitUseCases } from '../../../domain';
import { sendError } from './httpError';

interface GitHTTPDeps {
  workspaceId: string;
  runGitEffect: <A, E>(use: (service: IGitUseCases) => Effect.Effect<A, E>) => Promise<A>;
}

interface CommitLike {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
}

const serializeCommit = (commit: CommitLike) => ({
  ...commit,
  date: commit.date.toISOString(),
});

/**
 * HTTP inbound adapter for git.
 *
 * Push/pull/sync depend on ambient credentials (SSH agent or a credential
 * helper) that a headless server may not have; the use cases already classify
 * that as `errorKind: 'auth'` rather than hanging on a prompt.
 */
export class GitHTTP {
  constructor(private readonly deps: GitHTTPDeps) {}

  private workspaceId(body: unknown): string {
    const payload = (body as { workspaceId?: string } | undefined) ?? {};
    return payload.workspaceId ?? this.deps.workspaceId;
  }

  register(app: FastifyInstance): void {
    app.get('/api/git/status', async (request, reply) => {
      try {
        const query = request.query as { workspaceId?: string };
        const status = await this.deps.runGitEffect((service) =>
          service.getStatus.execute({
            workspaceId: query.workspaceId ?? this.deps.workspaceId,
          }),
        );
        // Matches GitIPC's projection: the UI wants counts, not file lists.
        return reply.send({
          isRepo: status.isRepo,
          branch: status.branch,
          hasRemote: Boolean(status.remote),
          remoteUrl: status.remote,
          ahead: status.ahead,
          behind: status.behind,
          staged: status.staged.length,
          unstaged: status.modified.length,
          untracked: status.untracked.length,
          lastSyncAt: status.lastSyncAt,
          hasChanges: status.hasChanges,
        });
      } catch (error) {
        return sendError(request, reply, error, 'Git');
      }
    });

    app.get('/api/git/commits', async (request, reply) => {
      try {
        const query = request.query as { workspaceId?: string; limit?: string };
        const limit = query.limit ? Number(query.limit) : undefined;
        const result = await this.deps.runGitEffect((service) =>
          service.getCommits.execute({
            workspaceId: query.workspaceId ?? this.deps.workspaceId,
            ...(Number.isInteger(limit) && limit! > 0 ? { limit } : {}),
          }),
        );
        return reply.send({ commits: result.commits.map(serializeCommit) });
      } catch (error) {
        return sendError(request, reply, error, 'Git');
      }
    });

    app.post('/api/git/actions/init', async (request, reply) => {
      try {
        await this.deps.runGitEffect((service) =>
          service.init.execute({ workspaceId: this.workspaceId(request.body) }),
        );
        return reply.send({ success: true });
      } catch (error) {
        return sendError(request, reply, error, 'Git');
      }
    });

    app.post('/api/git/actions/commit', async (request, reply) => {
      try {
        const body = (request.body as { message?: string } | undefined) ?? {};
        const commit = await this.deps.runGitEffect((service) =>
          service.commit.execute({
            workspaceId: this.workspaceId(request.body),
            ...(body.message ? { message: body.message } : {}),
          }),
        );
        if (!commit) {
          return reply
            .status(400)
            .send({ error: { code: 'NO_CHANGES', message: 'There is nothing to commit.' } });
        }
        return reply.send({ success: true, ...serializeCommit(commit) });
      } catch (error) {
        return sendError(request, reply, error, 'Git');
      }
    });

    for (const action of ['pull', 'push'] as const) {
      app.post(`/api/git/actions/${action}`, async (request, reply) => {
        try {
          const result = await this.deps.runGitEffect((service) =>
            service[action].execute({ workspaceId: this.workspaceId(request.body) }),
          );
          return reply.send(result);
        } catch (error) {
          return sendError(request, reply, error, 'Git');
        }
      });
    }

    app.post('/api/git/actions/sync', async (request, reply) => {
      try {
        const body = (request.body as { message?: string } | undefined) ?? {};
        const result = await this.deps.runGitEffect((service) =>
          service.sync.execute({
            workspaceId: this.workspaceId(request.body),
            ...(body.message ? { message: body.message } : {}),
          }),
        );
        return reply.send(result);
      } catch (error) {
        return sendError(request, reply, error, 'Git');
      }
    });

    app.post('/api/git/actions/set-remote', async (request, reply) => {
      try {
        const body = (request.body as { url?: string } | undefined) ?? {};
        if (!body.url) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'A remote URL is required.' } });
        }
        await this.deps.runGitEffect((service) =>
          service.setRemote.execute({
            workspaceId: this.workspaceId(request.body),
            url: body.url!,
          }),
        );
        return reply.send({ success: true });
      } catch (error) {
        return sendError(request, reply, error, 'Git');
      }
    });
  }
}
