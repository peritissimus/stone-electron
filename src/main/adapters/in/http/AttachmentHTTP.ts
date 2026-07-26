import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Effect } from 'effect';
import {
  DeleteAttachmentRequestSchema,
  GetAttachmentsRequestSchema,
  UploadImageRequestSchema,
} from '@shared/schemas';
import type { IAttachmentUseCases } from '../../../domain';

interface AttachmentHTTPDeps {
  runAttachmentEffect: <A, E>(
    use: (service: IAttachmentUseCases) => Effect.Effect<A, E>,
  ) => Promise<A>;
}

const sendError = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  const message = error instanceof Error ? error.message : 'Request failed';
  const statusCode = message.includes('not found') ? 404 : 500;
  if (statusCode === 500) {
    request.log.error({ err: error }, 'Attachment request failed');
  }
  return reply.status(statusCode).send({
    error: {
      code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'An unexpected server error occurred' : message,
    },
  });
};

/** HTTP inbound adapter for browser attachment upload and retrieval. */
export class AttachmentHTTP {
  constructor(private readonly deps: AttachmentHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/notes/:noteId/attachments', async (request, reply) => {
      try {
        const { noteId } = GetAttachmentsRequestSchema.parse(request.params);
        const attachments = await this.deps.runAttachmentEffect((service) =>
          service.getAttachments(noteId),
        );
        return reply.send({
          attachments: attachments.map((attachment) => ({
            ...attachment,
            createdAt: attachment.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.post('/api/notes/:noteId/attachments/images', async (request, reply) => {
      try {
        const parsed = UploadImageRequestSchema.parse({
          ...(request.body as Record<string, unknown>),
          ...(request.params as { noteId: string }),
        });
        const result = await this.deps.runAttachmentEffect((service) =>
          service.uploadImage(parsed.noteId, parsed.imageData, parsed.filename, parsed.mimeType),
        );
        const attachment = {
          ...result.attachment,
          createdAt: result.attachment.createdAt.toISOString(),
        };
        return reply.status(201).send({
          attachment,
          url: `/api/notes/${encodeURIComponent(parsed.noteId)}/attachments/${encodeURIComponent(result.attachment.id)}/content`,
        });
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.get('/api/notes/:noteId/attachments/:attachmentId/content', async (request, reply) => {
      try {
        const { noteId, attachmentId } = request.params as {
          noteId: string;
          attachmentId: string;
        };
        const result = await this.deps.runAttachmentEffect((service) =>
          service.getAttachmentContent(noteId, attachmentId),
        );
        return reply
          .type(result.mimeType)
          .header(
            'content-disposition',
            `inline; filename="${result.filename.replaceAll('"', '')}"`,
          )
          .send(Buffer.from(result.bytes));
      } catch (error) {
        return sendError(request, reply, error);
      }
    });

    app.delete('/api/attachments/:id', async (request, reply) => {
      try {
        const parsed = DeleteAttachmentRequestSchema.parse(request.params);
        await this.deps.runAttachmentEffect((service) => service.deleteAttachment(parsed.id, true));
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error);
      }
    });
  }
}
