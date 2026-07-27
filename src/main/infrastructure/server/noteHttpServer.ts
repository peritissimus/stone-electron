import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { LibraryHTTP } from '../../adapters/in/http/LibraryHTTP';
import { KnowledgeHTTP } from '../../adapters/in/http/KnowledgeHTTP';
import { AttachmentHTTP } from '../../adapters/in/http/AttachmentHTTP';
import { SettingsHTTP } from '../../adapters/in/http/SettingsHTTP';
import { WorkspaceHTTP } from '../../adapters/in/http/WorkspaceHTTP';
import { NoteHTTP } from '../../adapters/in/http/NoteHTTP';
import { GitHTTP } from '../../adapters/in/http/GitHTTP';
import { MaintenanceHTTP } from '../../adapters/in/http/MaintenanceHTTP';
import { AuthoringHTTP } from '../../adapters/in/http/AuthoringHTTP';
import { IntelligenceHTTP } from '../../adapters/in/http/IntelligenceHTTP';
import { EventStreamHTTP } from '../../adapters/in/http/EventStreamHTTP';
import { MeetingHTTP } from '../../adapters/in/http/MeetingHTTP';
import type { NoteServerRuntime } from '../di/noteServerRuntime';

export interface NoteHttpServerOptions {
  runtime: NoteServerRuntime;
  staticDir?: string;
  logger?: boolean;
}

export async function createNoteHttpServer(
  options: NoteHttpServerOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    // Fastify logs an "incoming request" and a "request completed" line for
    // every call. Combined with the adapter logs that made a single note fetch
    // five lines; the hook below reports only what is actually actionable.
    disableRequestLogging: true,
    bodyLimit: 512 * 1_048_576,
    // Generation-backed routes (status reports, ask-notes) routinely run past a
    // minute; the old 15s ceiling cut them off mid-call.
    requestTimeout: 180_000,
  });

  /** Slower than this and a request is worth a line even when it succeeded. */
  const SLOW_REQUEST_MS = 500;

  app.addHook('onResponse', (request, reply, done) => {
    const ms = reply.elapsedTime;
    if (reply.statusCode >= 500 || ms >= SLOW_REQUEST_MS) {
      request.log.warn(
        { method: request.method, url: request.url, statusCode: reply.statusCode, ms: Math.round(ms) },
        'request needs attention',
      );
    }
    done();
  });

  // Audio uploads arrive as raw bytes rather than base64 inside JSON.
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );

  new NoteHTTP({ runNoteEffect: options.runtime.runNoteEffect }).register(app);
  new LibraryHTTP({
    workspaceId: options.runtime.workspace.id,
    runNotebookEffect: options.runtime.runNotebookEffect,
    runTagEffect: options.runtime.runTagEffect,
    runTaskEffect: options.runtime.runTaskEffect,
    runQuickNoteEffect: options.runtime.runQuickNoteEffect,
  }).register(app);
  new KnowledgeHTTP({
    runNoteEffect: options.runtime.runNoteEffect,
    runGraphEffect: options.runtime.runGraphEffect,
    runVersionEffect: options.runtime.runVersionEffect,
    runJournalEffect: options.runtime.runJournalEffect,
  }).register(app);
  new AttachmentHTTP({
    runAttachmentEffect: options.runtime.runAttachmentEffect,
  }).register(app);
  new SettingsHTTP({
    runSettingsEffect: options.runtime.runSettingsEffect,
  }).register(app);
  new WorkspaceHTTP({
    workspace: options.runtime.workspace,
    runWorkspaceEffect: options.runtime.runWorkspaceEffect,
  }).register(app);
  new GitHTTP({
    workspaceId: options.runtime.workspace.id,
    runGitEffect: options.runtime.runGitEffect,
  }).register(app);
  new MaintenanceHTTP({
    workspaceId: options.runtime.workspace.id,
    runDatabaseEffect: options.runtime.runDatabaseEffect,
    runStatusReportEffect: options.runtime.runStatusReportEffect,
    runDailyReviewEffect: options.runtime.runDailyReviewEffect,
    performanceMonitor: options.runtime.performanceMonitor,
  }).register(app);
  new AuthoringHTTP({
    workspaceId: options.runtime.workspace.id,
    runTemplateEffect: options.runtime.runTemplateEffect,
    runExportEffect: options.runtime.runExportEffect,
    runQuickCaptureEffect: options.runtime.runQuickCaptureEffect,
  }).register(app);
  new EventStreamHTTP({ eventPublisher: options.runtime.eventPublisher }).register(app);
  new MeetingHTTP({
    workspaceId: options.runtime.workspace.id,
    runMeetingEffect: options.runtime.runMeetingEffect,
  }).register(app);
  new IntelligenceHTTP({
    workspaceId: options.runtime.workspace.id,
    runTopicEffect: options.runtime.runTopicEffect,
    runIndexEffect: options.runtime.runIndexEffect,
    runAIEffect: options.runtime.runAIEffect,
  }).register(app);

  const staticDir = options.staticDir ? path.resolve(options.staticDir) : undefined;
  const webEntry = staticDir ? path.join(staticDir, 'web.html') : undefined;

  if (staticDir && webEntry && fs.existsSync(webEntry)) {
    await app.register(fastifyStatic, {
      root: staticDir,
      index: false,
      wildcard: false,
    });

    // Quick capture is a separate entry, so it needs a route of its own ahead of
    // the SPA fallback below — otherwise /capture would serve the full client.
    if (fs.existsSync(path.join(staticDir, 'capture.html'))) {
      app.get('/capture', (_request, reply) => reply.type('text/html').sendFile('capture.html'));
    }

    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) {
        return reply.type('text/html').sendFile('web.html');
      }
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Route not found',
        },
      });
    });
  }

  return app;
}
