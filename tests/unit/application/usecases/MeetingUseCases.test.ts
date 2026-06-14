import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMeetingUseCases } from '../../../../src/main/application/usecases/meeting';
import { MeetingRecordingEntity, type MeetingRecordingProps } from '../../../../src/main/domain/entities/MeetingRecording';
import type { WorkspaceProps } from '../../../../src/main/domain/entities/Workspace';
import type { IMeetingUseCases } from '../../../../src/main/domain/ports/in/IMeetingUseCases';
import type { IFileStorage } from '../../../../src/main/domain/ports/out/IFileStorage';
import type { IMeetingRecordingRepository } from '../../../../src/main/domain/ports/out/IMeetingRecordingRepository';
import type { ISummarizationStrategy } from '../../../../src/main/domain/ports/out/ISummarizationStrategy';
import type { ITranscriber } from '../../../../src/main/domain/ports/out/ITranscriber';
import type { IWorkspaceRepository } from '../../../../src/main/domain/ports/out/IWorkspaceRepository';
import { createMockIdGenerator, createMockPathService } from './testDoubles';

function createMockMeetingRepository(): IMeetingRecordingRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  };
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
  let useCases: IMeetingUseCases;

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
    await expect(
      useCases.getMeetingRecording.execute({ recordingId: 'missing' }),
    ).resolves.toEqual({ recording: null });
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
    // Mic segments are labeled "You"; the summary receives the labeled transcript.
    expect(summarizer.summarize).toHaveBeenCalledWith({
      transcript: 'You: Transcript text',
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
      transcript: 'You: hello team\nOthers: hi there',
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
    expect(fileStorage.delete).toHaveBeenCalledWith('/workspace/.stone/recordings/rec-1.wav.aec.wav');
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
      appendToJournal,
      defaultPrompt: 'Default prompt {{transcript}}',
    });

    await aecUseCases.finalizeRecording.execute({ recordingId: 'rec-1', durationMs: 2_000 });

    // Mic transcribed from the RAW file — cancellation failure must not block it.
    expect(transcriber.transcribe).toHaveBeenCalledWith({
      audioPath: '/workspace/.stone/recordings/rec-1.wav',
    });
  });

  it('marks the recording failed and keeps audio when the finalize pipeline fails', async () => {
    vi.mocked(meetingRepository.findById).mockResolvedValue(recording());
    vi.mocked(workspaceRepository.findById).mockResolvedValue(workspace());
    vi.mocked(transcriber.transcribe).mockRejectedValue(new Error('whisper crashed'));

    const result = await useCases.finalizeRecording.execute({
      recordingId: 'rec-1',
      durationMs: 2_000,
    });

    expect(result.recording.status).toBe('failed');
    expect(result.recording.error).toBe('whisper crashed');
    expect(result.recording.audioPath).toBe('.stone/recordings/rec-1.wav');
    expect(fileStorage.delete).not.toHaveBeenCalledWith('/workspace/.stone/recordings/rec-1.wav');
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
});
