/**
 * Meeting IPC Adapter — exposes the meeting use cases to the renderer.
 *
 * Audio chunks come across the wire as ArrayBuffer (structured-clone).
 * For v1 the renderer sends the full WAV in one append; future
 * streaming variants can call APPEND_AUDIO multiple times.
 */

import { ipcMain } from 'electron';
import { MEETING_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import type { IMeetingUseCases } from '../../../domain';

export interface MeetingIPCDeps {
  meetingUseCases: IMeetingUseCases;
}

export function registerMeetingHandlers(deps: MeetingIPCDeps): void {
  const { meetingUseCases } = deps;
  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'MeetingIPC', defaultCode: 'MEETING_ERROR', context });

  ipcMain.handle(MEETING_CHANNELS.RESERVE_SLOT, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.reserveRecordingSlot.execute({
          workspaceId: request?.workspaceId,
          title: request?.title,
        }),
      { channel: MEETING_CHANNELS.RESERVE_SLOT },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.APPEND_AUDIO, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.appendRecordingAudio.execute({
          recordingId: request.recordingId,
          chunk: request.chunk,
          channel: request.channel,
        }),
      { channel: MEETING_CHANNELS.APPEND_AUDIO, recordingId: request?.recordingId },
    ),
  );

  // Enqueues the durable finalize job and returns immediately; the pipeline
  // runs in the background and pushes progress via meetings:statusChanged.
  ipcMain.handle(MEETING_CHANNELS.FINALIZE, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.requestFinalize.execute({
          recordingId: request.recordingId,
          durationMs: request.durationMs ?? 0,
        }),
      { channel: MEETING_CHANNELS.FINALIZE, recordingId: request?.recordingId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.LIST, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.listMeetingRecordings.execute({
          workspaceId: request?.workspaceId,
          limit: request?.limit,
          cursor: request?.cursor,
        }),
      { channel: MEETING_CHANNELS.LIST, workspaceId: request?.workspaceId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.GET, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.getMeetingRecording.execute({ recordingId: request.recordingId }),
      { channel: MEETING_CHANNELS.GET, recordingId: request?.recordingId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.GET_AUDIO, async (_event, request) =>
    handleRequest(
      async () => meetingUseCases.getMeetingAudio.execute({ recordingId: request.recordingId }),
      { channel: MEETING_CHANNELS.GET_AUDIO, recordingId: request?.recordingId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.DELETE, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.deleteMeetingRecording.execute({ recordingId: request.recordingId }),
      { channel: MEETING_CHANNELS.DELETE, recordingId: request?.recordingId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.RESUMMARIZE, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.resummarizeMeeting.execute({
          recordingId: request.recordingId,
          promptTemplate: request?.promptTemplate,
        }),
      { channel: MEETING_CHANNELS.RESUMMARIZE, recordingId: request?.recordingId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.RETRANSCRIBE, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.retranscribeMeeting.execute({ recordingId: request.recordingId }),
      { channel: MEETING_CHANNELS.RETRANSCRIBE, recordingId: request?.recordingId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.LIVE_START, async () =>
    handleRequest(async () => meetingUseCases.liveTranscription.start(), {
      channel: MEETING_CHANNELS.LIVE_START,
    }),
  );

  ipcMain.handle(MEETING_CHANNELS.LIVE_CHUNK, async (_event, request) =>
    handleRequest(
      async () => meetingUseCases.liveTranscription.transcribeChunk({ wav: request.wav }),
      { channel: MEETING_CHANNELS.LIVE_CHUNK },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.LIVE_STOP, async () =>
    handleRequest(async () => meetingUseCases.liveTranscription.stop(), {
      channel: MEETING_CHANNELS.LIVE_STOP,
    }),
  );

  ipcMain.handle(MEETING_CHANNELS.SEND_TO_JOURNAL, async (_event, request) =>
    handleRequest(
      async () =>
        meetingUseCases.sendToJournal.execute({
          recordingId: request.recordingId,
          journalDate: request?.journalDate,
        }),
      { channel: MEETING_CHANNELS.SEND_TO_JOURNAL, recordingId: request?.recordingId },
    ),
  );

  ipcMain.handle(MEETING_CHANNELS.WARM_TRANSCRIBER, async () =>
    handleRequest(async () => meetingUseCases.warmUpTranscriber.execute(), {
      channel: MEETING_CHANNELS.WARM_TRANSCRIBER,
    }),
  );
}

export function unregisterMeetingHandlers(): void {
  Object.values(MEETING_CHANNELS).forEach((channel) => ipcMain.removeHandler(channel));
}
