import type { FastifyInstance } from 'fastify';
import type { Effect } from 'effect';
import type {
  IExportUseCases,
  IQuickCaptureUseCases,
  ITemplateUseCases,
} from '../../../domain';
import { sendError } from './httpError';

interface AuthoringHTTPDeps {
  workspaceId: string;
  runTemplateEffect: <A, E>(use: (service: ITemplateUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runExportEffect: <A, E>(use: (service: IExportUseCases) => Effect.Effect<A, E>) => Promise<A>;
  runQuickCaptureEffect: <A, E>(
    use: (service: IQuickCaptureUseCases) => Effect.Effect<A, E>,
  ) => Promise<A>;
}

/**
 * HTTP inbound adapter for templates and export.
 *
 * Unlike the desktop adapter, export does not write the file itself — there is
 * no server-side save dialog, and the file belongs on the viewer's machine. The
 * rendered document is returned and the browser saves it.
 */
export class AuthoringHTTP {
  constructor(private readonly deps: AuthoringHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.post('/api/quick-capture/journal', async (request, reply) => {
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        const text = typeof body.text === 'string' ? body.text : String(body.content ?? '');
        return reply.send(
          await this.deps.runQuickCaptureEffect((service) =>
            service.appendToJournal(text, this.deps.workspaceId),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Quick capture');
      }
    });

    // Audio arrives as a raw body rather than JSON so a WAV does not have to be
    // base64-inflated on its way through the browser.
    app.post('/api/quick-capture/voice', async (request, reply) => {
      try {
        const wav = request.body;
        if (!Buffer.isBuffer(wav) || wav.length === 0) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'Audio body is required.' } });
        }
        return reply.send(
          await this.deps.runQuickCaptureEffect((service) =>
            service.transcribeVoiceCapture({
              wav: new Uint8Array(wav),
              workspaceId: this.deps.workspaceId,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Quick capture');
      }
    });

    app.get('/api/templates', async (request, reply) => {
      try {
        const query = request.query as { workspaceId?: string };
        return reply.send(
          await this.deps.runTemplateEffect((service) =>
            service.listTemplates.execute({
              workspaceId: query.workspaceId ?? this.deps.workspaceId,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Template');
      }
    });

    app.post('/api/templates/actions/create-note', async (request, reply) => {
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        if (typeof body.templateId !== 'string') {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'templateId is required.' } });
        }
        return reply.send(
          await this.deps.runTemplateEffect((service) =>
            service.createNoteFromTemplate.execute({
              templateId: body.templateId as string,
              workspaceId:
                typeof body.workspaceId === 'string' ? body.workspaceId : this.deps.workspaceId,
              ...(body.promptAnswers
                ? { promptAnswers: body.promptAnswers as Record<string, string> }
                : {}),
              ...(typeof body.destinationFolder === 'string'
                ? { destinationFolder: body.destinationFolder }
                : {}),
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Template');
      }
    });

    app.post('/api/notes/:id/export/:format', async (request, reply) => {
      const params = request.params as { id: string; format: string };
      try {
        const body = (request.body as Record<string, unknown> | undefined) ?? {};
        const options = {
          ...(typeof body.renderedHtml === 'string' ? { renderedHtml: body.renderedHtml } : {}),
          ...(typeof body.title === 'string' ? { title: body.title } : {}),
        };

        if (params.format === 'markdown') {
          const result = await this.deps.runExportEffect((service) =>
            service.exportMarkdown.execute(params.id, options),
          );
          return reply.send({ markdown: String(result.content), path: '' });
        }

        if (params.format === 'html') {
          const result = await this.deps.runExportEffect((service) =>
            service.exportHtml.execute(params.id, options),
          );
          return reply.send({ html: String(result.content), path: '' });
        }

        // PDF rendering needs a Chromium the server does not have. The browser
        // can print the same HTML, so hand it back and let the client do it.
        if (params.format === 'pdf') {
          const result = await this.deps.runExportEffect((service) =>
            service.exportHtml.execute(params.id, options),
          );
          return reply.send({ html: String(result.content), renderInBrowser: true, path: '' });
        }

        return reply
          .status(400)
          .send({ error: { code: 'VALIDATION_ERROR', message: 'Unsupported export format.' } });
      } catch (error) {
        return sendError(request, reply, error, 'Export');
      }
    });
  }
}
