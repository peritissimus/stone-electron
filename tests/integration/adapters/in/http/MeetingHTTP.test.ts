import Fastify from 'fastify';
import { Effect } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingHTTP } from '../../../../../src/main/adapters/in/http/MeetingHTTP';
import type { IMeetingUseCases, MeetingRecordingProps } from '../../../../../src/main/domain';

const recording = {
  id: 'rec-1',
  workspaceId: 'ws-1',
  title: 'Standup',
  status: 'ready',
  audioPath: '.stone/recordings/rec-1.wav',
  durationMs: 18_002,
  transcriptText: 'hello',
  transcriptSegments: [],
  summary: 'a summary',
  promptUsed: null,
  journalDate: null,
  error: null,
  createdAt: new Date('2026-07-15T15:39:00.000Z'),
  updatedAt: new Date('2026-07-15T15:40:00.000Z'),
} as unknown as MeetingRecordingProps;

const micBytes = new Uint8Array([1, 2, 3, 4]);

const appendRecordingAudio = vi.fn((_request: unknown) => Effect.void);
const requestFinalize = vi.fn(() => Effect.succeed({ jobId: 'job-1' }));
const transcribeChunk = vi.fn((_request: unknown) => Effect.succeed({ text: 'draft', segments: [] }));
const liveStart = vi.fn(() => Effect.void);
const liveStop = vi.fn(() => Effect.void);

function createApp() {
  const service = {
    listMeetingRecordings: {
      execute: () => Effect.succeed({ recordings: [recording], nextCursor: null }),
    },
    getMeetingRecording: { execute: () => Effect.succeed({ recording }) },
    getMeetingAudio: { execute: () => Effect.succeed({ mic: micBytes, system: null }) },
    deleteMeetingRecording: { execute: () => Effect.void },
    reserveRecordingSlot: {
      execute: () =>
        Effect.succeed({ recordingId: 'rec-2', audioAbsolutePath: '/tmp/rec-2.wav', systemAudio: false }),
    },
    appendRecordingAudio: { execute: appendRecordingAudio },
    requestFinalize: { execute: requestFinalize },
    resummarizeMeeting: { execute: () => Effect.succeed({ recording }) },
    retranscribeMeeting: { execute: () => Effect.succeed({ recording }) },
    sendToJournal: { execute: () => Effect.succeed({ recording, journalNoteId: 'note-9' }) },
    warmUpTranscriber: { execute: () => Effect.succeed({ ready: true }) },
    liveTranscription: { start: liveStart, stop: liveStop, transcribeChunk },
  } as unknown as IMeetingUseCases;

  const app = Fastify({ logger: false });
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_request, body, done) => done(null, body),
  );
  new MeetingHTTP({
    workspaceId: 'ws-1',
    runMeetingEffect: (use) => Effect.runPromise(use(service)),
  }).register(app);
  return app;
}

describe('MeetingHTTP', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes recording timestamps as ISO strings', async () => {
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: '/api/meetings' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.recordings[0]).toMatchObject({
      id: 'rec-1',
      createdAt: '2026-07-15T15:39:00.000Z',
      updatedAt: '2026-07-15T15:40:00.000Z',
    });
    expect(body.nextCursor).toBeNull();
    await app.close();
  });

  it('returns an audio track as raw wav bytes', async () => {
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: '/api/meetings/rec-1/audio/mic' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('audio/wav');
    expect([...response.rawPayload]).toEqual([1, 2, 3, 4]);
    await app.close();
  });

  it('reports a missing track as 404 rather than an error', async () => {
    const app = createApp();
    const response = await app.inject({ method: 'GET', url: '/api/meetings/rec-1/audio/system' });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('accepts a raw audio upload for a channel', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'PUT',
      url: '/api/meetings/rec-1/audio/system',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from([9, 8, 7]),
    });

    expect(response.statusCode).toBe(204);
    const call = appendRecordingAudio.mock.calls[0]![0] as unknown as {
      recordingId: string;
      channel: string;
      chunk: ArrayBuffer;
    };
    expect(call.recordingId).toBe('rec-1');
    expect(call.channel).toBe('system');
    expect([...new Uint8Array(call.chunk)]).toEqual([9, 8, 7]);
    await app.close();
  });

  it('rejects an unknown audio channel and an empty upload', async () => {
    const app = createApp();

    const badChannel = await app.inject({
      method: 'PUT',
      url: '/api/meetings/rec-1/audio/webcam',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from([1]),
    });
    expect(badChannel.statusCode).toBe(400);

    const empty = await app.inject({
      method: 'PUT',
      url: '/api/meetings/rec-1/audio/mic',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.alloc(0),
    });
    expect(empty.statusCode).toBe(400);
    expect(appendRecordingAudio).not.toHaveBeenCalled();
    await app.close();
  });

  it('enqueues finalize and returns the job id', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/meetings/rec-1/actions/finalize',
      payload: { durationMs: 18_002 },
    });

    expect(response.json()).toEqual({ jobId: 'job-1' });
    expect(requestFinalize).toHaveBeenCalledWith({ recordingId: 'rec-1', durationMs: 18_002 });
    await app.close();
  });

  it('defaults a finalize with no duration to zero', async () => {
    const app = createApp();
    await app.inject({ method: 'POST', url: '/api/meetings/rec-1/actions/finalize', payload: {} });

    expect(requestFinalize).toHaveBeenCalledWith({ recordingId: 'rec-1', durationMs: 0 });
    await app.close();
  });

  it('transcribes a live chunk sent as raw bytes', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/meetings/live/chunk',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from([4, 5, 6]),
    });

    expect(response.json()).toEqual({ text: 'draft', segments: [] });
    const call = transcribeChunk.mock.calls[0]![0] as unknown as { wav: ArrayBuffer };
    expect([...new Uint8Array(call.wav)]).toEqual([4, 5, 6]);
    await app.close();
  });

  it('starts and stops the live transcriber', async () => {
    const app = createApp();

    expect((await app.inject({ method: 'POST', url: '/api/meetings/live/start' })).statusCode).toBe(
      204,
    );
    expect((await app.inject({ method: 'POST', url: '/api/meetings/live/stop' })).statusCode).toBe(
      204,
    );
    expect(liveStart).toHaveBeenCalled();
    expect(liveStop).toHaveBeenCalled();
    await app.close();
  });

  it('returns the journal note id when sending to journal', async () => {
    const app = createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/meetings/rec-1/actions/send-to-journal',
      payload: {},
    });

    expect(response.json()).toMatchObject({ journalNoteId: 'note-9' });
    expect(response.json().recording.createdAt).toBe('2026-07-15T15:39:00.000Z');
    await app.close();
  });
});
