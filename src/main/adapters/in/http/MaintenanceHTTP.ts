import type { FastifyInstance } from 'fastify';
import type { Effect } from 'effect';
import type {
  IDailyReviewUseCases,
  IDatabaseUseCases,
  IPerformanceMonitor,
  IStatusReportUseCases,
} from '../../../domain';
import { sendError } from './httpError';
import { sendStreamedJson } from './streamedJson';

interface MaintenanceHTTPDeps {
  workspaceId: string;
  runDatabaseEffect: <A, E>(use: (service: IDatabaseUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runStatusReportEffect: <A, E>(
    use: (service: IStatusReportUseCases) => Effect.Effect<A, E>,
  ) => Promise<A>;
  runDailyReviewEffect: <A, E>(
    use: (service: IDailyReviewUseCases) => Effect.Effect<A, E>,
  ) => Promise<A>;
  performanceMonitor: IPerformanceMonitor;
}

/** HTTP inbound adapter for database maintenance and status reports. */
export class MaintenanceHTTP {
  constructor(private readonly deps: MaintenanceHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/database/status', async (request, reply) => {
      try {
        return reply.send(
          await this.deps.runDatabaseEffect((service) => service.getStatus.execute()),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Database');
      }
    });

    app.post('/api/database/actions/vacuum', async (request, reply) => {
      try {
        return reply.send(await this.deps.runDatabaseEffect((service) => service.vacuum.execute()));
      } catch (error) {
        return sendError(request, reply, error, 'Database');
      }
    });

    app.post('/api/database/actions/check-integrity', async (request, reply) => {
      try {
        return reply.send(
          await this.deps.runDatabaseEffect((service) => service.checkIntegrity.execute()),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Database');
      }
    });

    // Diagnostics describe the server process, which is where the work happens
    // for every connected browser.
    app.get('/api/performance/:metric', async (request, reply) => {
      const params = request.params as { metric: string };
      const query = request.query as { sinceMs?: string };
      const sinceMs = query.sinceMs ? Number(query.sinceMs) : undefined;
      const since = Number.isFinite(sinceMs) && sinceMs! >= 0 ? sinceMs : undefined;
      const monitor = this.deps.performanceMonitor;
      try {
        switch (params.metric) {
          case 'snapshot':
            return reply.send(monitor.getSnapshot(since));
          case 'memory':
            return reply.send(monitor.getMemoryMetrics());
          case 'cpu':
            return reply.send(monitor.getCPUMetrics());
          case 'ipc':
            return reply.send(monitor.getIPCMetrics(since));
          case 'database':
            return reply.send(monitor.getDatabaseMetrics(since));
          case 'startup':
            return reply.send(monitor.getSnapshot().startup);
          default:
            return reply
              .status(404)
              .send({ error: { code: 'NOT_FOUND', message: 'Unknown metric.' } });
        }
      } catch (error) {
        return sendError(request, reply, error, 'Performance');
      }
    });

    app.post('/api/performance/actions/clear-history', async (request, reply) => {
      try {
        this.deps.performanceMonitor.clearHistory();
        return reply.send({ success: true });
      } catch (error) {
        return sendError(request, reply, error, 'Performance');
      }
    });

    app.post('/api/daily-review/actions/summarize', async (request, reply) => {
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        return reply.send(
          await this.deps.runDailyReviewEffect((service) =>
            service.summarizeDailyReview.execute({
              workspaceId:
                typeof body.workspaceId === 'string' ? body.workspaceId : this.deps.workspaceId,
              ...(typeof body.date === 'string' ? { date: body.date } : {}),
              saveToJournal: body.saveToJournal === true,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Daily review');
      }
    });

    // Generation over a whole window runs well past a minute, so this streams
    // rather than making a proxy wait in silence for the first byte.
    app.post('/api/status-report', async (request, reply) => {
      const body = (request.body as Record<string, unknown> | undefined) ?? {};
      const windowDays = typeof body.windowDays === 'number' ? body.windowDays : undefined;
      await sendStreamedJson(request, reply, 'Status report', () =>
        this.deps.runStatusReportEffect((service) =>
          service.generate.execute({
            workspaceId:
              typeof body.workspaceId === 'string' ? body.workspaceId : this.deps.workspaceId,
            ...(windowDays ? { windowDays } : {}),
            ...(typeof body.promptTemplate === 'string'
              ? { promptTemplate: body.promptTemplate }
              : {}),
          }),
        ),
      );
    });
  }
}
