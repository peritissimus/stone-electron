import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { makeMeetingUseCasesLayer } from '../../../../src/main/application/usecases/meeting/meetingUseCases';
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
  type IEchoCanceller,
  type IIdGenerator,
  type ILiveTranscriber,
  type IPathService,
} from '../../../../src/main/domain';
import { adapterLayer } from '../../../helpers/adapterLayer';
import { useCasesLayer } from '../../../helpers/effectUseCases';
import {
  MeetingRecordingEntity,
  type MeetingRecordingProps,
} from '../../../../src/main/domain/entities/MeetingRecording';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { IMeetingUseCases } from '../../../../src/main/domain/ports/in/IMeetingUseCases';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IMeetingRecordingRepository } from '../../../../src/main/domain/ports/out/IMeetingRecordingRepository';
import type { IAppConfigRepository } from '../../../../src/main/domain/ports/out/IAppConfigRepository';
import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
} from '../../../../src/main/domain/value-objects/AppConfig';
import type { ISummarizationStrategy } from '../../../../src/main/domain/ports/out/ISummarizationStrategy';
import type { ITranscriber } from '../../../../src/main/domain/ports/out/ITranscriber';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import type { IEventPublisher } from '../../../../src/main/domain/ports/out/IEventPublisher';
import type { IJobQueue } from '../../../../src/main/domain/ports/out/IJobQueue';
import { createMockIdGenerator, createMockPathService } from './testDoubles';

function createMockMeetingRepository(): IMeetingRecordingRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    listWithAudioOlderThan: vi.fn().mockResolvedValue([]),
  };
}

function createMockEventPublisher(): IEventPublisher {
  return {
    publish: vi.fn(),
    publishAll: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    subscribeAll: vi.fn(() => () => {}),
  };
}

function createMockJobQueue(): IJobQueue {
  return {
    enqueue: vi.fn(async () => 'job-1'),
  };
}

function createMockAppConfigRepository(audioRetentionDays = 0): IAppConfigRepository {
  const config: AppConfig = {
    ...DEFAULT_APP_CONFIG,
    meetings: { ...DEFAULT_APP_CONFIG.meetings, audioRetentionDays },
  };
  return {
    get: vi.fn().mockResolvedValue(config),
    update: vi.fn(async (mutate: (config: AppConfig) => AppConfig) => mutate(config)),
  } as unknown as IAppConfigRepository;
}

function createMockWorkspaceRepository(): IWorkspaceRepository {
  return {
    findById: vi.fn(),
    findActive: vi.fn(),
  } as unknown as IWorkspaceRepository;
}

function createMockFileStorage(): IFileStorage {
  return {
    read: vi.fn(),
    write: vi.fn(),
    writeBytes: vi.fn(),
    readBytes: vi.fn().mockResolvedValue(null),
    delete: vi.fn(),
    exists: vi.fn(),
    rename: vi.fn(),
    createDirectory: vi.fn(),
    deleteDirectory: vi.fn(),
    listFiles: vi.fn(),
    glob: vi.fn(),
    getFileInfo: vi.fn(),
    copy: vi.fn(),
    watch: vi.fn(),
  } as unknown as IFileStorage;
}

function createMockTranscriber(): ITranscriber {
  return {
    isReady: vi.fn().mockReturnValue(true),
    initialize: vi.fn(),
    transcribe: vi.fn().mockResolvedValue({
      text: 'Transcript text',
      segments: [{ text: 'Transcript text', startMs: 0, endMs: 1_000 }],
      durationMs: 1_000,
    }),
  };
}

function createMockSummarizer(): ISummarizationStrategy {
  return {
    summarize: vi.fn().mockResolvedValue({
      summary: '- Summary',
      promptUsed: 'Prompt {{transcript}}',
    }),
  };
}

function workspace(overrides: Partial<WorkspaceProps> = {}): WorkspaceProps {
  return {
    id: 'ws-1',
    name: 'Workspace',
    folderPath: '/workspace',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00'),
    lastAccessedAt: new Date('2026-01-02T00:00:00'),
    ...overrides,
  };
}

function recording(overrides: Partial<MeetingRecordingProps> = {}): MeetingRecordingEntity {
  return MeetingRecordingEntity.fromPersistence({
    id: 'rec-1',
    workspaceId: 'ws-1',
    title: 'Planning',
    status: 'recording',
    audioPath: '.stone/recordings/rec-1.wav',
    durationMs: 0,
    transcriptText: null,
    transcriptSegments: [],
    summary: null,
    promptUsed: null,
    journalDate: null,
    error: null,
    createdAt: new Date('2026-04-21T09:00:00'),
    updatedAt: new Date('2026-04-21T09:00:00'),
    ...overrides,
  });
}

interface MeetingTestDeps {
  meetingRepository: IMeetingRecordingRepository;
  workspaceRepository: IWorkspaceRepository;
  fileStorage: IFileStorage;
  idGenerator: IIdGenerator;
  pathService: IPathService;
  transcriber: ITranscriber;
  summarizer: ISummarizationStrategy;
  appConfigRepository: IAppConfigRepository;
  eventPublisher: IEventPublisher;
  jobQueue: IJobQueue;
  echoCanceller?: IEchoCanceller;
  liveTranscriber?: ILiveTranscriber;
  appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
  defaultPrompt?: string;
}

type PromiseMeetingUseCases<T> = T extends (
  ...args: infer Args
) => Effect.Effect<infer Success, unknown, unknown>
  ? (...args: Args) => Promise<Success>
  : T extends object
    ? { [Key in keyof T]: PromiseMeetingUseCases<T[Key]> }
    : T;

function createMeetingUseCases(
  deps: MeetingTestDeps,
): PromiseMeetingUseCases<IMeetingUseCases> {
  const live = deps.liveTranscriber;
  const dependencyLayer = Layer.mergeAll(
    adapterLayer(MeetingRecordingRepositoryPort, deps.meetingRepository),
    adapterLayer(WorkspaceRepositoryPort, deps.workspaceRepository),
    adapterLayer(FileStoragePort, deps.fileStorage),
    adapterLayer(IdGeneratorPort, deps.idGenerator),
    adapterLayer(PathServicePort, deps.pathService),
    adapterLayer(TranscriberPort, deps.transcriber),
    adapterLayer(SummarizationStrategyPort, deps.summarizer),
    adapterLayer(AppConfigRepositoryPort, deps.appConfigRepository),
    adapterLayer(EventPublisherPort, deps.eventPublisher),
    adapterLayer(
      EchoCancellerPort,
      deps.echoCanceller ?? {
        cancel: async () => {
          throw new Error('echo cancellation unavailable');
        },
      },
    ),
    Layer.succeed(JobQueue, {
      enqueue: (type, payload, options) =>
        Effect.tryPromise(() => deps.jobQueue.enqueue(type, payload, options)),
    }),
    Layer.succeed(LiveTranscriber, {
      isReady: Effect.sync(() => live?.isReady() ?? false),
      start: Effect.tryPromise(() => live?.start() ?? Promise.resolve()),
      stop: Effect.tryPromise(() => live?.stop() ?? Promise.resolve()),
      transcribeChunk: (wav) =>
        Effect.tryPromise(() =>
          live?.transcribeChunk(wav) ?? Promise.resolve({ text: '', segments: [] }),
        ),
    }),
    useCasesLayer(QuickCaptureUseCasesPort, {
      appendToJournal: deps.appendToJournal,
      transcribeVoiceCapture: async (_request: {
        wav: Uint8Array;
        workspaceId?: string;
      }) => ({ text: '', durationMs: 0 }),
    }),
  );
  const runtime = ManagedRuntime.make(
    makeMeetingUseCasesLayer({ defaultPrompt: deps.defaultPrompt }).pipe(
      Layer.provide(dependencyLayer),
    ),
  );
  const run = <A, E>(
    use: (service: IMeetingUseCases) => Effect.Effect<A, E>,
  ) =>
    runtime.runPromise(
      MeetingUseCasesPort.pipe(Effect.flatMap((service) => use(service))),
    );

  return {
    reserveRecordingSlot: {
      execute: (request) => run((service) => service.reserveRecordingSlot.execute(request)),
    },
    appendRecordingAudio: {
      execute: (request) => run((service) => service.appendRecordingAudio.execute(request)),
    },
    requestFinalize: {
      execute: (request) => run((service) => service.requestFinalize.execute(request)),
    },
    finalizeRecording: {
      execute: (request, options) =>
        run((service) => service.finalizeRecording.execute(request, options)),
    },
    listMeetingRecordings: {
      execute: (request) => run((service) => service.listMeetingRecordings.execute(request)),
    },
    getMeetingRecording: {
      execute: (request) => run((service) => service.getMeetingRecording.execute(request)),
    },
    getMeetingAudio: {
      execute: (request) => run((service) => service.getMeetingAudio.execute(request)),
    },
    deleteMeetingRecording: {
      execute: (request) => run((service) => service.deleteMeetingRecording.execute(request)),
    },
    resummarizeMeeting: {
      execute: (request) => run((service) => service.resummarizeMeeting.execute(request)),
    },
    retranscribeMeeting: {
      execute: (request) => run((service) => service.retranscribeMeeting.execute(request)),
    },
    sendToJournal: {
      execute: (request) => run((service) => service.sendToJournal.execute(request)),
    },
    pruneRecordingAudio: {
      execute: () => run((service) => service.pruneRecordingAudio.execute()),
    },
    warmUpTranscriber: {
      execute: () => run((service) => service.warmUpTranscriber.execute()),
    },
    liveTranscription: {
      start: () => run((service) => service.liveTranscription.start()),
      transcribeChunk: (request) =>
        run((service) => service.liveTranscription.transcribeChunk(request)),
      stop: () => run((service) => service.liveTranscription.stop()),
    },
  };
}

describe('MeetingUseCases', () => {
  let meetingRepository: IMeetingRecordingRepository;
  let workspaceRepository: IWorkspaceRepository;
  let fileStorage: IFileStorage;
  let transcriber: ITranscriber;
  let summarizer: ISummarizationStrategy;
  let appendToJournal: (
    content: string,
    workspaceId?: string,
  ) => Promise<{ noteId: string; appended: boolean }>;
  let useCases: PromiseMeetingUseCases<IMeetingUseCases>;

  beforeEach(() => {
    meetingRepository = createMockMeetingRepository();
    workspaceRepository = createMockWorkspaceRepository();
    fileStorage = createMockFileStorage();
    transcriber = createMockTranscriber();
    summarizer = createMockSummarizer();
    appendToJournal = vi.fn(async () => ({ noteId: 'journal-1', appended: true }));
    useCases = createMeetingUseCases({
      meetingRepository,
      workspaceRepository,
      fileStorage,
      idGenerator: createMockIdGenerator(),
      pathService: createMockPathService(),
      transcriber,
      summarizer,
      appConfigRepository: createMockAppConfigRepository(),
      eventPublisher: createMockEventPublisher(),
      jobQueue: createMockJobQueue(),
      appendToJournal,
      defaultPrompt: 'Default prompt {{transcript}}',
    });
  });

  it('reserves an audio slot (renderer loopback owns system audio)', async () => {
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());

    const result = await useCases.reserveRecordingSlot.execute({ title: 'Design review' });

    expect(result).toEqual({
      recordingId: 'generated-id',
      audioAbsolutePath: '/workspace/.stone/recordings/generated-id.wav',
      systemAudio: false,
    });
    expect(fileStorage.createDirectory).toHaveBeenCalledWith('/workspace/.stone/recordings');
    expect(meetingRepository.save).toHaveBeenCalledWith(expect.any(MeetingRecordingEntity));
  });

  it('reserves the slot for an explicit workspace id', async () => {
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace({ id: 'ws-2' }));

    const result = await useCases.reserveRecordingSlot.execute({ workspaceId: 'ws-2' });

    expect(workspaceRepository.findById).toHaveBeenCalledWith('ws-2');
    expect(result.systemAudio).toBe(false);
    expect(meetingRepository.save).toHaveBeenCalled();
  });

  it('writes captured audio bytes to the reserved file', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    const bytes = new Uint8Array([1, 2, 3]);

    await useCases.appendRecordingAudio.execute({
      recordingId: 'rec-1',
      chunk: bytes.buffer,
    });

    expect(fileStorage.writeBytes).toHaveBeenCalledWith(
      '/workspace/.stone/recordings/rec-1.wav',
      bytes,
      { append: false },
    );
  });

  it('enqueues finalize without duplicating downstream recording validation', async () => {
    const result = await useCases.requestFinalize.execute({
      recordingId: 'rec-1',
      durationMs: 2_000,
    });

    expect(result).toEqual({ jobId: 'job-1' });
    expect(meetingRepository.findById).not.toHaveBeenCalled();
  });

  it('lists recordings from the active workspace with a Date cursor', async () => {
    const rec = recording({ id: 'rec-list', status: 'ready' });
    vi.mocked(workspaceRepository.findActive).mockResolvedValue(workspace());
    vi.mocked(meetingRepository.list).mockResolvedValue({
      recordings: [rec],
      nextCursor: new Date('2026-04-20T10:00:00'),
    });

    const result = await useCases.listMeetingRecordings.execute({
      limit: 10,
      cursor: Date.parse('2026-04-21T10:00:00'),
    });

    expect(meetingRepository.list).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      limit: 10,
      cursor: new Date('2026-04-21T10:00:00'),
    });
    expect(result.recordings[0].id).toBe('rec-list');
    expect(result.nextCursor).toBe(Date.parse('2026-04-20T10:00:00'));
  });

  it('gets one recording or null', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValueOnce(recording({ id: 'rec-found' }));
    vi.mocked(meetingRepository.findById).mockResolvedValueOnce(null);

    await expect(
      useCases.getMeetingRecording.execute({ recordingId: 'rec-found' }),
    ).resolves.toMatchObject({ recording: { id: 'rec-found' } });
    await expect(useCases.getMeetingRecording.execute({ recordingId: 'missing' })).resolves.toEqual(
      { recording: null },
    );
  });

  it('deletes database rows and best-effort audio files', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.delete).mockRejectedValueOnce(new Error('already gone'));

    await useCases.deleteMeetingRecording.execute({ recordingId: 'rec-1' });

    expect(fileStorage.delete).toHaveBeenCalledWith('/workspace/.stone/recordings/rec-1.wav');
    expect(meetingRepository.delete).toHaveBeenCalledWith('rec-1');
  });

  it('resummarizes a transcript without touching the journal', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(
      recording({ status: 'ready', transcriptText: 'Raw transcript', summary: 'old' }),
    );
    vi.mocked(summarizer.summarize).mockResolvedValue({
      summary: '- Fresh summary',
      promptUsed: 'Custom {{transcript}}',
    });

    const result = await useCases.resummarizeMeeting.execute({
      recordingId: 'rec-1',
      promptTemplate: 'Custom {{transcript}}',
    });

    expect(summarizer.summarize).toHaveBeenCalledWith({
      transcript: 'Raw transcript',
      promptTemplate: 'Custom {{transcript}}',
    });
    expect(result.recording.summary).toBe('- Fresh summary');
    expect(appendToJournal).not.toHaveBeenCalled();
  });

  it('sends a summarized meeting to the journal and marks the publish date', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(
      recording({ status: 'ready', summary: '- Summary' }),
    );

    const result = await useCases.sendToJournal.execute({
      recordingId: 'rec-1',
      journalDate: '2026-04-21',
    });

    expect(appendToJournal).toHaveBeenCalledWith('### Planning\n- Summary', 'ws-1');
    expect(result.journalNoteId).toBe('journal-1');
    expect(result.recording.journalDate).toBe('2026-04-21');
    expect(meetingRepository.save).toHaveBeenCalledWith(expect.any(MeetingRecordingEntity));
  });

  it('finalizes by transcribing the mic track and labeling it by source', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(false); // no system track
    vi.mocked(transcriber.transcribe).mockResolvedValue({
      text: 'Transcript text',
      segments: [{ text: 'Transcript text', startMs: 0, endMs: 1_000 }],
      durationMs: 500,
    });

    const result = await useCases.finalizeRecording.execute({
      recordingId: 'rec-1',
      durationMs: 2_000,
    });

    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.wav',
    });
    // The summary receives the structured transcript: [mm:ss] (Speaker) text.
    // No confidence on these mock segments, so no <BAND>.
    expect(summarizer.summarize).toHaveBeenCalledWith({
      transcript: '[00:00] (You) Transcript text',
      promptTemplate: 'Default prompt {{transcript}}',
    });
    expect(result.recording.status).toBe('ready');
    expect(result.recording.durationMs).toBe(2_000);
    // NOTE: audio deletion is temporarily disabled (per-source transcription work).
  });

  it('transcribes mic + system tracks separately when a system track exists', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(true); // system track present
    vi.mocked(transcriber.transcribe)
      .mockResolvedValueOnce({
        text: 'hello team',
        segments: [{ text: 'hello team', startMs: 0, endMs: 1_000 }],
        durationMs: 1_000,
      })
      .mockResolvedValueOnce({
        text: 'hi there',
        segments: [{ text: 'hi there', startMs: 500, endMs: 1_500 }],
        durationMs: 1_500,
      });

    await useCases.finalizeRecording.execute({ recordingId: 'rec-1', durationMs: 2_000 });

    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.wav',
    });
    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.system.wav',
    });
    // Interleaved by start time, labeled You (mic @0) then Others (system @500).
    expect(summarizer.summarize).toHaveBeenCalledWith({
      transcript: '[00:00] (You) hello team\n[00:00] (Others) hi there',
      promptTemplate: 'Default prompt {{transcript}}',
    });
  });

  it('echo-cancels the mic against the system reference before transcription', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(true); // system track present
    vi.mocked(fileStorage.delete).mockResolvedValue(undefined);
    vi.mocked(transcriber.transcribe).mockResolvedValue({
      text: 'hello',
      segments: [{ text: 'hello', startMs: 0, endMs: 1_000 }],
      durationMs: 1_000,
    });
    const echoCanceller = {
      isReady: vi.fn(() => true),
      initialize: vi.fn(async () => {}),
      cancel: vi.fn(async () => {}),
    };
    const aecUseCases = createMeetingUseCases({
      meetingRepository,
      workspaceRepository,
      fileStorage,
      idGenerator: createMockIdGenerator(),
      pathService: createMockPathService(),
      transcriber,
      summarizer,
      echoCanceller,
      appConfigRepository: createMockAppConfigRepository(),
      eventPublisher: createMockEventPublisher(),
      jobQueue: createMockJobQueue(),
      appendToJournal,
      defaultPrompt: 'Default prompt {{transcript}}',
    });

    await aecUseCases.finalizeRecording.execute({ recordingId: 'rec-1', durationMs: 2_000 });

    expect(echoCanceller.cancel).toHaveBeenCalledWith({
      micPath: '/workspace/.stone/recordings/rec-1.wav',
      referencePath: '/workspace/.stone/recordings/rec-1.system.wav',
      outputPath: '/workspace/.stone/recordings/rec-1.wav.aec.wav',
    });
    // Mic transcribed from the cleaned file; system from the raw reference.
    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.wav.aec.wav',
    });
    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.system.wav',
    });
    // The temp cleaned file is removed after transcription.
    expect(fileStorage.delete).toHaveBeenCalledWith(
      '/workspace/.stone/recordings/rec-1.wav.aec.wav',
    );
  });

  it('falls back to the raw mic when echo cancellation fails', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(true);
    vi.mocked(fileStorage.delete).mockResolvedValue(undefined);
    vi.mocked(transcriber.transcribe).mockResolvedValue({
      text: 'hello',
      segments: [{ text: 'hello', startMs: 0, endMs: 1_000 }],
      durationMs: 1_000,
    });
    const echoCanceller = {
      isReady: vi.fn(() => false),
      initialize: vi.fn(async () => {}),
      cancel: vi.fn(async () => {
        throw new Error('model missing');
      }),
    };
    const aecUseCases = createMeetingUseCases({
      meetingRepository,
      workspaceRepository,
      fileStorage,
      idGenerator: createMockIdGenerator(),
      pathService: createMockPathService(),
      transcriber,
      summarizer,
      echoCanceller,
      appConfigRepository: createMockAppConfigRepository(),
      eventPublisher: createMockEventPublisher(),
      jobQueue: createMockJobQueue(),
      appendToJournal,
      defaultPrompt: 'Default prompt {{transcript}}',
    });

    await aecUseCases.finalizeRecording.execute({ recordingId: 'rec-1', durationMs: 2_000 });

    // Mic transcribed from the RAW file — cancellation failure must not block it.
    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.wav',
    });
  });

  it('marks the recording failed, keeps audio, and propagates finalize failures', async () => {
    const failedRecording = recording();
    vi.mocked(meetingRepository.findById).mockResolvedValue(failedRecording);
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(transcriber.transcribe).mockRejectedValue(new Error('whisper crashed'));

    await expect(
      useCases.finalizeRecording.execute({
        recordingId: 'rec-1',
        durationMs: 2_000,
      }),
    ).rejects.toThrow('whisper crashed');

    expect(failedRecording.status).toBe('failed');
    expect(failedRecording.error).toBe('whisper crashed');
    expect(failedRecording.audioPath).toBe('.stone/recordings/rec-1.wav');
    expect(fileStorage.delete).not.toHaveBeenCalledWith('/workspace/.stone/recordings/rec-1.wav');
  });

  it('threads durable-job cancellation into transcription', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(false);
    const controller = new AbortController();

    await useCases.finalizeRecording.execute(
      { recordingId: 'rec-1', durationMs: 2_000 },
      { signal: controller.signal },
    );

    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.wav',
      signal: controller.signal,
    });
  });

  it('re-transcribes a recording from its kept audio', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    // Mic audio present; no system track.
    vi.mocked(fileStorage.exists).mockImplementation(
      async (p) => p === '/workspace/.stone/recordings/rec-1.wav',
    );
    vi.mocked(transcriber.transcribe).mockResolvedValue({
      text: 'redone',
      segments: [{ text: 'redone', startMs: 0, endMs: 1_000 }],
      durationMs: 1_000,
    });

    const result = await useCases.retranscribeMeeting.execute({ recordingId: 'rec-1' });

    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.wav',
    });
    expect(result.recording.transcriptText).toBe('You: redone');
  });

  it('refuses to re-transcribe when the audio is gone', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording({ audioPath: null }));

    await expect(useCases.retranscribeMeeting.execute({ recordingId: 'rec-1' })).rejects.toThrow(
      /audio/i,
    );
  });

  it('deletes audio after finalize when retention is "delete after transcribing" (-1)', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(false); // mic-only
    vi.mocked(fileStorage.delete).mockResolvedValue(undefined);

    const deleteNowUseCases = createMeetingUseCases({
      meetingRepository,
      workspaceRepository,
      fileStorage,
      idGenerator: createMockIdGenerator(),
      pathService: createMockPathService(),
      transcriber,
      summarizer,
      appConfigRepository: createMockAppConfigRepository(-1),
      eventPublisher: createMockEventPublisher(),
      jobQueue: createMockJobQueue(),
      appendToJournal,
      defaultPrompt: 'Default prompt {{transcript}}',
    });

    const result = await deleteNowUseCases.finalizeRecording.execute({
      recordingId: 'rec-1',
      durationMs: 2_000,
    });

    // Both tracks removed; transcript + summary survive, audioPath cleared.
    expect(fileStorage.delete).toHaveBeenCalledWith('/workspace/.stone/recordings/rec-1.wav');
    expect(fileStorage.delete).toHaveBeenCalledWith(
      '/workspace/.stone/recordings/rec-1.system.wav',
    );
    expect(result.recording.audioPath).toBeNull();
    expect(result.recording.transcriptText).toBeTruthy();
  });

  it('keeps audio after finalize when retention keeps it (0)', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.exists).mockResolvedValue(false);
    vi.mocked(fileStorage.delete).mockResolvedValue(undefined);

    const result = await useCases.finalizeRecording.execute({
      recordingId: 'rec-1',
      durationMs: 2_000,
    });

    expect(fileStorage.delete).not.toHaveBeenCalledWith('/workspace/.stone/recordings/rec-1.wav');
    expect(result.recording.audioPath).toBe('.stone/recordings/rec-1.wav');
  });

  it('prunes audio for recordings past the retention window (N days)', async () => {
    const stale = recording();
    vi.mocked(meetingRepository.listWithAudioOlderThan).mockResolvedValue([stale]);
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(fileStorage.delete).mockResolvedValue(undefined);

    const pruneUseCases = createMeetingUseCases({
      meetingRepository,
      workspaceRepository,
      fileStorage,
      idGenerator: createMockIdGenerator(),
      pathService: createMockPathService(),
      transcriber,
      summarizer,
      appConfigRepository: createMockAppConfigRepository(30),
      eventPublisher: createMockEventPublisher(),
      jobQueue: createMockJobQueue(),
      appendToJournal,
      defaultPrompt: 'Default prompt {{transcript}}',
    });

    const result = await pruneUseCases.pruneRecordingAudio.execute();

    expect(result.deletedCount).toBe(1);
    expect(fileStorage.delete).toHaveBeenCalledWith('/workspace/.stone/recordings/rec-1.wav');
    expect(fileStorage.delete).toHaveBeenCalledWith(
      '/workspace/.stone/recordings/rec-1.system.wav',
    );
    // Persisted with audioPath cleared.
    const saved = vi.mocked(meetingRepository.save).mock.calls.at(-1)?.[0];
    expect(saved?.audioPath).toBeNull();
  });

  it('warms up the transcriber, initializing it when not ready', async () => {
    vi.mocked(transcriber.isReady).mockReturnValueOnce(false).mockReturnValueOnce(true);

    await expect(useCases.warmUpTranscriber.execute()).resolves.toEqual({ ready: true });
    expect(transcriber.initialize).toHaveBeenCalled();
  });

  it('reports the transcriber not ready when warm-up fails', async () => {
    vi.mocked(transcriber.isReady).mockReturnValue(false);
    vi.mocked(transcriber.initialize).mockRejectedValue(new Error('download failed'));

    await expect(useCases.warmUpTranscriber.execute()).resolves.toEqual({ ready: false });
  });

  it('does not prune audio when retention keeps it (0)', async () => {
    const pruneUseCases = createMeetingUseCases({
      meetingRepository,
      workspaceRepository,
      fileStorage,
      idGenerator: createMockIdGenerator(),
      pathService: createMockPathService(),
      transcriber,
      summarizer,
      appConfigRepository: createMockAppConfigRepository(0),
      eventPublisher: createMockEventPublisher(),
      jobQueue: createMockJobQueue(),
      appendToJournal,
      defaultPrompt: 'Default prompt {{transcript}}',
    });

    const result = await pruneUseCases.pruneRecordingAudio.execute();

    expect(result.deletedCount).toBe(0);
    expect(meetingRepository.listWithAudioOlderThan).not.toHaveBeenCalled();
  });
});
