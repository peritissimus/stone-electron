/**
 * Meeting IPC Adapter — exposes the meeting use cases to the renderer.
 *
 * Audio chunks come across the wire as ArrayBuffer (structured-clone).
 * For v1 the renderer sends the full WAV in one append; future
 * streaming variants can call APPEND_AUDIO multiple times.
 */

import { ipcMain } from 'electron';
import type { Effect } from 'effect';
import { MEETING_CHANNELS } from '@shared/constants/ipcChannels';
import {
  AppendRecordingAudioRequestSchema,
  FinalizeRecordingRequestSchema,
  ListMeetingsRequestSchema,
  LiveChunkRequestSchema,
  RecordingIdRequestSchema,
  ReserveRecordingRequestSchema,
  ResummarizeMeetingRequestSchema,
  SendMeetingToJournalRequestSchema,
} from '@shared/schemas';
import { handleIpcRequest } from '@main/shared/utils';
import type { IMeetingUseCases } from '../../../domain';

export interface MeetingIPCDeps {
  runMeetingEffect: RunMeetingEffect;
}

export type RunMeetingEffect = <A, E>(
  use: (service: IMeetingUseCases) => Effect.Effect<A, E>,
) => Promise<A>;

export function registerMeetingHandlers(deps: MeetingIPCDeps): void {
  const { runMeetingEffect } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'MeetingIPC', defaultCode: 'MEETING_ERROR', context });

  ipcMain.handle(MEETING_CHANNELS.RESERVE_SLOT, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.reserveRecordingSlot.execute(
            ReserveRecordingRequestSchema.parse(rawRequest ?? {}),
          ),
        ),
      { channel: MEETING_CHANNELS.RESERVE_SLOT },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.APPEND_AUDIO, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.appendRecordingAudio.execute(
            AppendRecordingAudioRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.APPEND_AUDIO },
    ),
  );

  // Enqueues the durable finalize job and returns immediately; the pipeline
  // runs in the background and pushes progress via meetings:statusChanged.
  ipcMain.handle(MEETING_CHANNELS.FINALIZE, async (_event, rawRequest) =>
    handleRequest(
      async () => {
        const request = FinalizeRecordingRequestSchema.parse(rawRequest);
        return runMeetingEffect((meetingUseCases) =>
          meetingUseCases.requestFinalize.execute({
            ...request,
            durationMs: request.durationMs ?? 0,
          }),
        );
      },
      { channel: MEETING_CHANNELS.FINALIZE },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.LIST, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.listMeetingRecordings.execute(
            ListMeetingsRequestSchema.parse(rawRequest ?? {}),
          ),
        ),
      { channel: MEETING_CHANNELS.LIST },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.GET, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.getMeetingRecording.execute(
            RecordingIdRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.GET },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.GET_AUDIO, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.getMeetingAudio.execute(
            RecordingIdRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.GET_AUDIO },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.DELETE, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.deleteMeetingRecording.execute(
            RecordingIdRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.DELETE },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.RESUMMARIZE, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.resummarizeMeeting.execute(
            ResummarizeMeetingRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.RESUMMARIZE },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.RETRANSCRIBE, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.retranscribeMeeting.execute(
            RecordingIdRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.RETRANSCRIBE },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.LIVE_START, async () =>
    handleRequest(async () => runMeetingEffect((meetingUseCases) =>
      meetingUseCases.liveTranscription.start(),
    ), {
      channel: MEETING_CHANNELS.LIVE_START,
    }),
  );

  ipcMain.handle(MEETING_CHANNELS.LIVE_CHUNK, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.liveTranscription.transcribeChunk(
            LiveChunkRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.LIVE_CHUNK },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.LIVE_STOP, async () =>
    handleRequest(async () => runMeetingEffect((meetingUseCases) =>
      meetingUseCases.liveTranscription.stop(),
    ), {
      channel: MEETING_CHANNELS.LIVE_STOP,
    }),
  );

  ipcMain.handle(MEETING_CHANNELS.SEND_TO_JOURNAL, async (_event, rawRequest) =>
    handleRequest(
      async () =>
        runMeetingEffect((meetingUseCases) =>
          meetingUseCases.sendToJournal.execute(
            SendMeetingToJournalRequestSchema.parse(rawRequest),
          ),
        ),
      { channel: MEETING_CHANNELS.SEND_TO_JOURNAL },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.WARM_TRANSCRIBER, async () =>
    handleRequest(async () => runMeetingEffect((meetingUseCases) =>
      meetingUseCases.warmUpTranscriber.execute(),
    ), {
      channel: MEETING_CHANNELS.WARM_TRANSCRIBER,
    }),
  );
}

export function unregisterMeetingHandlers(): void {
  Object.values(MEETING_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
