import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  AppConfigRepositoryPort,
  EchoCancellerPort,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  JobQueue,
  LiveTranscriber,
  MeetingRecordingRepositoryPort,
  MeetingUseCasesPort,
  PathServicePort,
  QuickCaptureUseCasesPort,
  SummarizationStrategyPort,
  TranscriberPort,
  WorkspaceRepositoryPort,
} from '../../../../src/main/domain';
import {
  MEETING_FINALIZE_JOB,
  MeetingUseCasesLive,
} from '../../../../src/main/application/usecases/meeting/meetingUseCases';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { useCasesLayer } from '../../../helpers/effectUseCases';

function dependencies(overrides: {
  enqueue?: (type: string, payload: unknown) => Effect.Effect<string, Error>;
  transcribeChunk?: (
    wav: Uint8Array,
  ) => Effect.Effect<{ text: string; segments: [] }, Error>;
} = {}) {
  return Layer.mergeAll(
    adapterLayer(MeetingRecordingRepositoryPort, {} as never),
    adapterLayer(
      WorkspaceRepositoryPort,
      {
        findActive: async () => ({
          id: 'ws-1',
          name: 'Workspace',
          folderPath: '/workspace',
          isActive: true,
          createdAt: new Date(0),
          lastAccessedAt: new Date(0),
        }),
      } as never,
    ),
    adapterLayer(
      FileStoragePort,
      {
        createDirectory: async () => undefined,
      } as never,
    ),
    adapterLayer(IdGeneratorPort, { generate: () => 'rec-1' } as never),
    adapterLayer(
      PathServicePort,
      { join: (...parts: string[]) => parts.join('/').replaceAll('//', '/') } as never,
    ),
    adapterLayer(TranscriberPort, {} as never),
    adapterLayer(SummarizationStrategyPort, {} as never),
    adapterLayer(AppConfigRepositoryPort, {} as never),
    adapterLayer(EventPublisherPort, {} as never),
    adapterLayer(EchoCancellerPort, {} as never),
    Layer.succeed(JobQueue, {
      enqueue: overrides.enqueue ?? (() => Effect.succeed('job-1')),
    }),
    Layer.succeed(LiveTranscriber, {
      isReady: Effect.succeed(false),
      start: Effect.void,
      stop: Effect.void,
      transcribeChunk:
        overrides.transcribeChunk ??
        (() => Effect.succeed({ text: '', segments: [] })),
    }),
    useCasesLayer(QuickCaptureUseCasesPort, {
      appendToJournal: async (_content: string, _workspaceId?: string) => ({
        noteId: 'journal-1',
        appended: true,
      }),
      transcribeVoiceCapture: async (_request: {
        wav: Uint8Array;
        workspaceId?: string;
      }) => ({ text: '', durationMs: 0 }),
    }),
  );
}

describe('MeetingUseCasesLive', () => {
  it('provides per-action Effect functions through dependency layers', async () => {
    const calls: Array<{ type: string; payload: unknown }> = [];
    const layer = MeetingUseCasesLive.pipe(
      Layer.provide(
        dependencies({
          enqueue: (type, payload) =>
            Effect.sync(() => {
              calls.push({ type, payload });
              return 'job-42';
            }),
        }),
      ),
    );

    const result = await Effect.runPromise(
      MeetingUseCasesPort.pipe(
        Effect.flatMap((service) =>
          service.requestFinalize.execute({
            recordingId: 'rec-1',
            durationMs: 1_500,
          }),
        ),
        Effect.provide(layer),
      ),
    );

    expect(result).toEqual({ jobId: 'job-42' });
    expect(calls).toEqual([
      {
        type: MEETING_FINALIZE_JOB,
        payload: { recordingId: 'rec-1', durationMs: 1_500 },
      },
    ]);
  });

  it('routes live chunks through the native live-transcriber capability', async () => {
    const seen: number[][] = [];
    const layer = MeetingUseCasesLive.pipe(
      Layer.provide(
        dependencies({
          transcribeChunk: (wav) =>
            Effect.sync(() => {
              seen.push([...wav]);
              return { text: 'hello', segments: [] };
            }),
        }),
      ),
    );

    const result = await Effect.runPromise(
      MeetingUseCasesPort.pipe(
        Effect.flatMap((service) =>
          service.liveTranscription.transcribeChunk({
            wav: new Uint8Array([1, 2, 3]).buffer,
          }),
        ),
        Effect.provide(layer),
      ),
    );

    expect(result.text).toBe('hello');
    expect(seen).toEqual([[1, 2, 3]]);
  });
});
