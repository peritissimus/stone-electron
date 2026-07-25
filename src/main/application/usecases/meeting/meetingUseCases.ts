import { Effect, Layer } from 'effect';
import {
  AppConfigRepositoryPort,
  buildSummaryTranscript,
  buildTranscriptText,
  DEFAULT_MEETING_SUMMARY_PROMPT,
  EchoCancellerPort,
  EventPublisherPort,
  FileStoragePort,
  IdGeneratorPort,
  JobQueue,
  LiveTranscriber,
  MeetingRecordingEntity,
  MeetingRecordingNotFoundError,
  MeetingRecordingRepositoryPort,
  MeetingUseCasesPort,
  PathServicePort,
  QuickCaptureUseCasesPort,
  SummarizationStrategyPort,
  systemTrackPath,
  TranscriberPort,
  WorkspaceRepositoryPort,
  type IMeetingUseCases,
  type TranscriptSegment,
} from '../../../domain';

export const MEETING_FINALIZE_JOB = 'meeting.finalize';
export const RECORDINGS_DIR = '.stone/recordings';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function makeMeetingUseCasesLayer(
  options: { defaultPrompt?: string } = {},
) {
  const defaultPrompt =
    options.defaultPrompt ?? DEFAULT_MEETING_SUMMARY_PROMPT;
  return Layer.effect(
    MeetingUseCasesPort,
    Effect.gen(function* () {
    const meetingRepository = yield* MeetingRecordingRepositoryPort;
    const workspaceRepository = yield* WorkspaceRepositoryPort;
    const fileStorage = yield* FileStoragePort;
    const idGenerator = yield* IdGeneratorPort;
    const pathService = yield* PathServicePort;
    const transcriber = yield* TranscriberPort;
    const summarizer = yield* SummarizationStrategyPort;
    const appConfigRepository = yield* AppConfigRepositoryPort;
    const eventPublisher = yield* EventPublisherPort;
    const echoCanceller = yield* EchoCancellerPort;
    const jobQueue = yield* JobQueue;
    const liveTranscriber = yield* LiveTranscriber;
    const quickCapture = yield* QuickCaptureUseCasesPort;

    const publishStatus = (recording: MeetingRecordingEntity) =>
      Effect.gen(function* () {
        const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
        yield* eventPublisher.publish({
          type: 'meeting:statusChanged',
          timestamp: new Date(now),
          payload: { recording: recording.toPersistence() },
        });
      });

    const deleteAudioFiles = (
      workspaceFolderPath: string,
      relativeAudioPath: string,
    ): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        const micAbsolute = yield* pathService.join(workspaceFolderPath, relativeAudioPath);
        const systemRelative = systemTrackPath(relativeAudioPath);
        const systemAbsolute = yield* pathService.join(workspaceFolderPath, systemRelative);
        yield* Effect.forEach(
          [micAbsolute, systemAbsolute],
          (path) => fileStorage.delete(path).pipe(Effect.catchAll(() => Effect.void)),
          { discard: true },
        );
      });

    const cancelEcho = (
      micPath: string,
      referencePath: string,
    ): Effect.Effect<string, never> => {
      const outputPath = `${micPath}.aec.wav`;
      return echoCanceller
        .cancel({ micPath, referencePath, outputPath })
        .pipe(
          Effect.as(outputPath),
          Effect.catchAll(() =>
            fileStorage
              .delete(outputPath)
              .pipe(Effect.catchAll(() => Effect.void), Effect.as(micPath)),
          ),
        );
    };

    const reprocessRecordingAudio = (
      recording: MeetingRecordingEntity,
      audioAbsolutePath: string,
      systemAbsolutePath: string,
      promptTemplate: string,
      requestDurationMs: number,
      signal?: AbortSignal,
    ): Effect.Effect<void, Error> =>
      Effect.gen(function* () {
        recording.markTranscribing();
        yield* meetingRepository.save(recording);
        yield* publishStatus(recording);

        const hasSystemTrack = yield* fileStorage.exists(systemAbsolutePath);
        const micForTranscription = hasSystemTrack
          ? yield* cancelEcho(audioAbsolutePath, systemAbsolutePath)
          : audioAbsolutePath;
        const micResult = yield* transcriber.transcribe(
          signal
            ? { audioPath: micForTranscription, signal }
            : { audioPath: micForTranscription },
        );
        const segments: TranscriptSegment[] = micResult.segments.map((segment) => ({
          ...segment,
          source: 'mic',
        }));
        let maxDurationMs = micResult.durationMs;

        if (micForTranscription !== audioAbsolutePath) {
          yield* fileStorage.delete(micForTranscription).pipe(Effect.catchAll(() => Effect.void));
        }

        if (hasSystemTrack) {
          const systemResult = yield* transcriber.transcribe(
            signal
              ? { audioPath: systemAbsolutePath, signal }
              : { audioPath: systemAbsolutePath },
          );
          segments.push(
            ...systemResult.segments.map((segment) => ({
              ...segment,
              source: 'system' as const,
            })),
          );
          maxDurationMs = Math.max(maxDurationMs, systemResult.durationMs);
        }

        segments.sort((left, right) => left.startMs - right.startMs);
        recording.attachTranscript(
          buildTranscriptText(segments),
          segments,
          Math.max(maxDurationMs, requestDurationMs),
        );
        yield* meetingRepository.save(recording);
        yield* publishStatus(recording);

        const summary = yield* summarizer.summarize({
          transcript: buildSummaryTranscript(segments),
          promptTemplate,
        });
        recording.attachSummary(summary.summary, summary.promptUsed);
        yield* meetingRepository.save(recording);
        yield* publishStatus(recording);
      });

    const service: IMeetingUseCases = {
      reserveRecordingSlot: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspace = request.workspaceId
              ? yield* workspaceRepository.findById(request.workspaceId)
              : yield* workspaceRepository.findActive();
            if (!workspace) return yield* Effect.fail(new Error('No active workspace'));

            const id = yield* idGenerator.generate();
            const audioRelativePath = `${RECORDINGS_DIR}/${id}.wav`;
            const audioAbsolutePath = yield* pathService.join(
              workspace.folderPath,
              audioRelativePath,
            );
            const recordingsDirectory = yield* pathService.join(
              workspace.folderPath,
              RECORDINGS_DIR,
            );
            yield* fileStorage.createDirectory(recordingsDirectory);
            yield* meetingRepository.save(
              MeetingRecordingEntity.create({
                id,
                workspaceId: workspace.id,
                title: request.title ?? '',
                audioPath: audioRelativePath,
              }),
            );
            return { recordingId: id, audioAbsolutePath, systemAudio: false };
          }),
      },
      appendRecordingAudio: {
        execute: (request) =>
          Effect.gen(function* () {
            const recording = yield* meetingRepository.findById(request.recordingId);
            if (!recording) {
              return yield* Effect.fail(
                new MeetingRecordingNotFoundError(request.recordingId),
              );
            }
            if (!recording.audioPath) {
              return yield* Effect.fail(
                new Error(`Recording ${request.recordingId} has no audio path`),
              );
            }
            const workspace = yield* workspaceRepository.findById(recording.workspaceId);
            if (!workspace) {
              return yield* Effect.fail(
                new Error(`Workspace ${recording.workspaceId} no longer exists`),
              );
            }
            const relativePath =
              request.channel === 'system'
                ? systemTrackPath(recording.audioPath)
                : recording.audioPath;
            const absolutePath = yield* pathService.join(workspace.folderPath, relativePath);
            yield* fileStorage.writeBytes(
              absolutePath,
              new Uint8Array(request.chunk),
              { append: false },
            );
          }),
      },
      requestFinalize: {
        execute: (request) =>
          jobQueue
            .enqueue(MEETING_FINALIZE_JOB, {
              recordingId: request.recordingId,
              durationMs: request.durationMs,
            })
            .pipe(Effect.map((jobId) => ({ jobId }))),
      },
      finalizeRecording: {
        execute: (request, options = {}) =>
          Effect.gen(function* () {
            const recording = yield* meetingRepository.findById(request.recordingId);
            if (!recording) {
              return yield* Effect.fail(
                new MeetingRecordingNotFoundError(request.recordingId),
              );
            }
            if (recording.status === 'ready') {
              return { recording: recording.toPersistence() };
            }
            if (!recording.audioPath) {
              return yield* Effect.fail(
                new Error(`Recording ${request.recordingId} has no audio path`),
              );
            }
            const workspace = yield* workspaceRepository.findById(recording.workspaceId);
            if (!workspace) {
              return yield* Effect.fail(
                new Error(`Workspace ${recording.workspaceId} no longer exists`),
              );
            }
            const audioAbsolutePath = yield* pathService.join(
              workspace.folderPath,
              recording.audioPath,
            );
            const systemAbsolutePath = yield* pathService.join(
              workspace.folderPath,
              systemTrackPath(recording.audioPath),
            );

            yield* reprocessRecordingAudio(
              recording,
              audioAbsolutePath,
              systemAbsolutePath,
              defaultPrompt,
              request.durationMs,
              options.signal,
            ).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  recording.markFailed(error.message);
                  yield* meetingRepository.save(recording);
                  yield* publishStatus(recording);
                  return yield* Effect.fail(error);
                }),
              ),
            );

            const config = yield* appConfigRepository.get();
            if (config.meetings.audioRetentionDays === -1 && recording.audioPath) {
              yield* deleteAudioFiles(workspace.folderPath, recording.audioPath);
              recording.clearAudio();
              yield* meetingRepository.save(recording);
              yield* publishStatus(recording);
            }
            return { recording: recording.toPersistence() };
          }),
      },
      listMeetingRecordings: {
        execute: (request) =>
          Effect.gen(function* () {
            const workspaceId =
              request.workspaceId ?? (yield* workspaceRepository.findActive())?.id;
            if (!workspaceId) return { recordings: [], nextCursor: null };
            const result = yield* meetingRepository.list({
              workspaceId,
              limit: request.limit ?? 30,
              cursor: request.cursor ? new Date(request.cursor) : undefined,
            });
            return {
              recordings: result.recordings.map((recording) =>
                recording.toPersistence(),
              ),
              nextCursor: result.nextCursor?.getTime() ?? null,
            };
          }),
      },
      getMeetingRecording: {
        execute: (request) =>
          meetingRepository
            .findById(request.recordingId)
            .pipe(
              Effect.map((recording) => ({
                recording: recording?.toPersistence() ?? null,
              })),
            ),
      },
      getMeetingAudio: {
        execute: (request) =>
          Effect.gen(function* () {
            const recording = yield* meetingRepository.findById(request.recordingId);
            if (!recording) {
              return yield* Effect.fail(
                new MeetingRecordingNotFoundError(request.recordingId),
              );
            }
            if (!recording.audioPath) return { mic: null, system: null };
            const workspace = yield* workspaceRepository.findById(recording.workspaceId);
            if (!workspace) return { mic: null, system: null };
            const micPath = yield* pathService.join(
              workspace.folderPath,
              recording.audioPath,
            );
            const systemPath = yield* pathService.join(
              workspace.folderPath,
              systemTrackPath(recording.audioPath),
            );
            const [mic, system] = yield* Effect.all(
              [fileStorage.readBytes(micPath), fileStorage.readBytes(systemPath)],
              { concurrency: 2 },
            );
            return { mic, system };
          }),
      },
      deleteMeetingRecording: {
        execute: (request) =>
          Effect.gen(function* () {
            const recording = yield* meetingRepository.findById(request.recordingId);
            if (!recording) return;
            if (recording.audioPath) {
              const workspace = yield* workspaceRepository.findById(recording.workspaceId);
              if (workspace) {
                yield* deleteAudioFiles(workspace.folderPath, recording.audioPath);
              }
            }
            yield* meetingRepository.delete(recording.id);
          }),
      },
      resummarizeMeeting: {
        execute: (request) =>
          Effect.gen(function* () {
            const recording = yield* meetingRepository.findById(request.recordingId);
            if (!recording) {
              return yield* Effect.fail(
                new MeetingRecordingNotFoundError(request.recordingId),
              );
            }
            if (!recording.transcriptText) {
              return yield* Effect.fail(
                new Error(`Recording ${recording.id} has no transcript to summarize`),
              );
            }
            const transcript =
              recording.transcriptSegments.length > 0
                ? buildSummaryTranscript(recording.transcriptSegments)
                : recording.transcriptText;
            const result = yield* summarizer.summarize({
              transcript,
              promptTemplate:
                request.promptTemplate ?? defaultPrompt,
            });
            recording.replaceSummary(result.summary, result.promptUsed);
            yield* meetingRepository.save(recording);
            return { recording: recording.toPersistence() };
          }),
      },
      retranscribeMeeting: {
        execute: (request) =>
          Effect.gen(function* () {
            const recording = yield* meetingRepository.findById(request.recordingId);
            if (!recording) {
              return yield* Effect.fail(
                new MeetingRecordingNotFoundError(request.recordingId),
              );
            }
            if (!recording.audioPath) {
              return yield* Effect.fail(
                new Error(
                  "This recording's audio was deleted, so it can't be re-transcribed.",
                ),
              );
            }
            const workspace = yield* workspaceRepository.findById(recording.workspaceId);
            if (!workspace) {
              return yield* Effect.fail(
                new Error(`Workspace ${recording.workspaceId} no longer exists`),
              );
            }
            const audioAbsolutePath = yield* pathService.join(
              workspace.folderPath,
              recording.audioPath,
            );
            if (!(yield* fileStorage.exists(audioAbsolutePath))) {
              return yield* Effect.fail(
                new Error(
                  "This recording's audio file is missing, so it can't be re-transcribed.",
                ),
              );
            }
            const systemAbsolutePath = yield* pathService.join(
              workspace.folderPath,
              systemTrackPath(recording.audioPath),
            );
            yield* reprocessRecordingAudio(
              recording,
              audioAbsolutePath,
              systemAbsolutePath,
              defaultPrompt,
              0,
            ).pipe(
              Effect.catchAll((error) =>
                Effect.gen(function* () {
                  recording.markFailed(error.message);
                  yield* meetingRepository.save(recording);
                  yield* publishStatus(recording);
                }),
              ),
            );
            return { recording: recording.toPersistence() };
          }),
      },
      sendToJournal: {
        execute: (request) =>
          Effect.gen(function* () {
            const recording = yield* meetingRepository.findById(request.recordingId);
            if (!recording) {
              return yield* Effect.fail(
                new MeetingRecordingNotFoundError(request.recordingId),
              );
            }
            if (!recording.summary) {
              return yield* Effect.fail(
                new Error(`Recording ${recording.id} has no summary to send`),
              );
            }
            const result = yield* quickCapture.appendToJournal(
              `### ${recording.title}\n${recording.summary}`,
              recording.workspaceId,
            );
            const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
            recording.markJournaledFor(
              request.journalDate ?? localIsoDate(new Date(now)),
            );
            yield* meetingRepository.save(recording);
            return {
              recording: recording.toPersistence(),
              journalNoteId: result.noteId,
            };
          }),
      },
      pruneRecordingAudio: {
        execute: () =>
          Effect.gen(function* () {
            const config = yield* appConfigRepository.get();
            const days = config.meetings.audioRetentionDays;
            if (!Number.isFinite(days) || !Number.isInteger(days) || days <= 0) {
              return { deletedCount: 0 };
            }
            const now = yield* Effect.clockWith((clock) => clock.currentTimeMillis);
            const stale = yield* meetingRepository.listWithAudioOlderThan(
              new Date(now - days * MS_PER_DAY),
            );
            const folderPaths = new Map<string, string | null>();
            let deletedCount = 0;
            for (const recording of stale) {
              if (!recording.audioPath) continue;
              let folderPath = folderPaths.get(recording.workspaceId);
              if (folderPath === undefined) {
                const workspace = yield* workspaceRepository.findById(
                  recording.workspaceId,
                );
                folderPath = workspace?.folderPath ?? null;
                folderPaths.set(recording.workspaceId, folderPath);
              }
              if (!folderPath) continue;
              yield* deleteAudioFiles(folderPath, recording.audioPath);
              recording.clearAudio();
              yield* meetingRepository.save(recording);
              deletedCount += 1;
            }
            return { deletedCount };
          }),
      },
      warmUpTranscriber: {
        execute: () =>
          Effect.gen(function* () {
            const ready = yield* transcriber.isReady();
            if (!ready) yield* transcriber.initialize();
            return { ready: yield* transcriber.isReady() };
          }).pipe(Effect.catchAll(() => Effect.succeed({ ready: false }))),
      },
      liveTranscription: {
        start: () => liveTranscriber.start,
        transcribeChunk: ({ wav }) =>
          liveTranscriber.transcribeChunk(new Uint8Array(wav)),
        stop: () => liveTranscriber.stop,
      },
    };
      return service;
    }),
  );
}

export const MeetingUseCasesLive = makeMeetingUseCasesLayer();

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
