import type { FastifyInstance } from 'fastify';
import type { Effect } from 'effect';
import type { IMeetingUseCases, MeetingRecordingProps } from '../../../domain';
import { sendError } from './httpError';

interface MeetingHTTPDeps {
  workspaceId: string;
  runMeetingEffect: <A, E>(use: (service: IMeetingUseCases) => Effect.Effect<A, E>) => Promise<A>;
}

const serializeRecording = (recording: MeetingRecordingProps) => ({
  ...recording,
  createdAt: recording.createdAt.toISOString(),
  updatedAt: recording.updatedAt.toISOString(),
});

/**
 * HTTP inbound adapter for meeting recordings.
 *
 * Audio moves as raw bytes rather than JSON — a recording is roughly 1.9 MB per
 * minute per track, which base64 would inflate by a third for no benefit.
 */
export class MeetingHTTP {
  constructor(private readonly deps: MeetingHTTPDeps) {}

  register(app: FastifyInstance): void {
    app.get('/api/meetings', async (request, reply) => {
      try {
        const query = request.query as { limit?: string; cursor?: string; workspaceId?: string };
        const limit = query.limit ? Number(query.limit) : undefined;
        const cursor = query.cursor ? Number(query.cursor) : undefined;
        const result = await this.deps.runMeetingEffect((service) =>
          service.listMeetingRecordings.execute({
            workspaceId: query.workspaceId ?? this.deps.workspaceId,
            ...(Number.isFinite(limit) ? { limit } : {}),
            ...(Number.isFinite(cursor) ? { cursor } : {}),
          }),
        );
        return reply.send({
          recordings: result.recordings.map(serializeRecording),
          nextCursor: result.nextCursor,
        });
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.get('/api/meetings/:id', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        const result = await this.deps.runMeetingEffect((service) =>
          service.getMeetingRecording.execute({ recordingId: params.id }),
        );
        return reply.send({
          recording: result.recording ? serializeRecording(result.recording) : null,
        });
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.delete('/api/meetings/:id', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        await this.deps.runMeetingEffect((service) =>
          service.deleteMeetingRecording.execute({ recordingId: params.id }),
        );
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.post('/api/meetings', async (request, reply) => {
      try {
        const body = (request.body as { title?: string; workspaceId?: string } | undefined) ?? {};
        const slot = await this.deps.runMeetingEffect((service) =>
          service.reserveRecordingSlot.execute({
            workspaceId: body.workspaceId ?? this.deps.workspaceId,
            ...(body.title ? { title: body.title } : {}),
          }),
        );
        return reply.status(201).send(slot);
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    // The whole track for one channel, as raw bytes.
    app.put('/api/meetings/:id/audio/:channel', async (request, reply) => {
      const params = request.params as { id: string; channel: 'mic' | 'system' };
      try {
        if (params.channel !== 'mic' && params.channel !== 'system') {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'Unknown audio channel.' } });
        }
        const chunk = request.body;
        if (!Buffer.isBuffer(chunk) || chunk.length === 0) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'Audio body is required.' } });
        }
        await this.deps.runMeetingEffect((service) =>
          service.appendRecordingAudio.execute({
            recordingId: params.id,
            // Copied so the use case owns a buffer Fastify will not reuse.
            chunk: chunk.buffer.slice(
              chunk.byteOffset,
              chunk.byteOffset + chunk.byteLength,
            ) as ArrayBuffer,
            channel: params.channel,
          }),
        );
        return reply.status(204).send();
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.get('/api/meetings/:id/audio/:channel', async (request, reply) => {
      const params = request.params as { id: string; channel: string };
      try {
        const audio = await this.deps.runMeetingEffect((service) =>
          service.getMeetingAudio.execute({ recordingId: params.id }),
        );
        const track = params.channel === 'system' ? audio.system : audio.mic;
        if (!track) {
          return reply
            .status(404)
            .send({ error: { code: 'NOT_FOUND', message: 'No audio for that channel.' } });
        }
        return reply.type('audio/wav').send(Buffer.from(track));
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.post('/api/meetings/:id/actions/finalize', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        const body = (request.body as { durationMs?: number } | undefined) ?? {};
        return reply.send(
          await this.deps.runMeetingEffect((service) =>
            service.requestFinalize.execute({
              recordingId: params.id,
              durationMs: body.durationMs ?? 0,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.post('/api/meetings/:id/actions/resummarize', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        const body = (request.body as { promptTemplate?: string } | undefined) ?? {};
        const result = await this.deps.runMeetingEffect((service) =>
          service.resummarizeMeeting.execute({
            recordingId: params.id,
            ...(body.promptTemplate ? { promptTemplate: body.promptTemplate } : {}),
          }),
        );
        return reply.send({ recording: serializeRecording(result.recording) });
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.post('/api/meetings/:id/actions/retranscribe', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        const result = await this.deps.runMeetingEffect((service) =>
          service.retranscribeMeeting.execute({ recordingId: params.id }),
        );
        return reply.send({ recording: serializeRecording(result.recording) });
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.post('/api/meetings/:id/actions/send-to-journal', async (request, reply) => {
      const params = request.params as { id: string };
      try {
        const body = (request.body as { journalDate?: string } | undefined) ?? {};
        const result = await this.deps.runMeetingEffect((service) =>
          service.sendToJournal.execute({
            recordingId: params.id,
            ...(body.journalDate ? { journalDate: body.journalDate } : {}),
          }),
        );
        return reply.send({
          recording: serializeRecording(result.recording),
          journalNoteId: result.journalNoteId,
        });
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    app.post('/api/meetings/actions/warm-transcriber', async (request, reply) => {
      try {
        return reply.send(
          await this.deps.runMeetingEffect((service) => service.warmUpTranscriber.execute()),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });

    for (const phase of ['start', 'stop'] as const) {
      app.post(`/api/meetings/live/${phase}`, async (request, reply) => {
        try {
          await this.deps.runMeetingEffect((service) => service.liveTranscription[phase]());
          return reply.status(204).send();
        } catch (error) {
          return sendError(request, reply, error, 'Meeting');
        }
      });
    }

    app.post('/api/meetings/live/chunk', async (request, reply) => {
      try {
        const wav = request.body;
        if (!Buffer.isBuffer(wav) || wav.length === 0) {
          return reply
            .status(400)
            .send({ error: { code: 'VALIDATION_ERROR', message: 'Audio body is required.' } });
        }
        return reply.send(
          await this.deps.runMeetingEffect((service) =>
            service.liveTranscription.transcribeChunk({
              wav: wav.buffer.slice(
                wav.byteOffset,
                wav.byteOffset + wav.byteLength,
              ) as ArrayBuffer,
            }),
          ),
        );
      } catch (error) {
        return sendError(request, reply, error, 'Meeting');
      }
    });
  }
}
