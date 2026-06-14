import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AI_CHANNELS,
  ATTACHMENT_CHANNELS,
  DAILY_REVIEW_CHANNELS,
  DATABASE_CHANNELS,
  GIT_CHANNELS,
  INDEX_CHANNELS,
  JOURNAL_CHANNELS,
  MEETING_CHANNELS,
  NOTE_CHANNELS,
  PERFORMANCE_CHANNELS,
  QUICK_CAPTURE_CHANNELS,
  QUICK_NOTE_CHANNELS,
  SCRATCH_CHANNELS,
  SETTINGS_CHANNELS,
  STATUS_REPORT_CHANNELS,
  SYSTEM_CHANNELS,
  TEMPLATE_CHANNELS,
  TOPIC_CHANNELS,
} from '../../../../../src/shared/constants/ipcChannels';
import { registerAIHandlers, unregisterAIHandlers } from '../../../../../src/main/adapters/in/ipc/AIIPC';
import {
  registerAttachmentHandlers,
  unregisterAttachmentHandlers,
} from '../../../../../src/main/adapters/in/ipc/AttachmentIPC';
import {
  registerDailyReviewHandlers,
  unregisterDailyReviewHandlers,
} from '../../../../../src/main/adapters/in/ipc/DailyReviewIPC';
import {
  registerDatabaseHandlers,
  unregisterDatabaseHandlers,
} from '../../../../../src/main/adapters/in/ipc/DatabaseIPC';
import {
  registerExportHandlers,
  unregisterExportHandlers,
} from '../../../../../src/main/adapters/in/ipc/ExportIPC';
import { registerGitHandlers, unregisterGitHandlers } from '../../../../../src/main/adapters/in/ipc/GitIPC';
import {
  registerGraphHandlers,
  unregisterGraphHandlers,
} from '../../../../../src/main/adapters/in/ipc/GraphIPC';
import {
  registerIndexHandlers,
  unregisterIndexHandlers,
} from '../../../../../src/main/adapters/in/ipc/IndexIPC';
import {
  registerJournalHandlers,
  unregisterJournalHandlers,
} from '../../../../../src/main/adapters/in/ipc/JournalIPC';
import {
  registerMeetingHandlers,
  unregisterMeetingHandlers,
} from '../../../../../src/main/adapters/in/ipc/MeetingIPC';
import {
  registerPerformanceHandlers,
  setMainWindow,
  unregisterPerformanceHandlers,
} from '../../../../../src/main/adapters/in/ipc/PerformanceIPC';
import {
  registerQuickCaptureHandlers,
  unregisterQuickCaptureHandlers,
} from '../../../../../src/main/adapters/in/ipc/QuickCaptureIPC';
import {
  registerQuickNoteHandlers,
  unregisterQuickNoteHandlers,
} from '../../../../../src/main/adapters/in/ipc/QuickNoteIPC';
import {
  registerScratchHandlers,
  unregisterScratchHandlers,
} from '../../../../../src/main/adapters/in/ipc/ScratchIPC';
import {
  registerStatusReportHandlers,
  unregisterStatusReportHandlers,
} from '../../../../../src/main/adapters/in/ipc/StatusReportIPC';
import {
  registerSettingsHandlers,
  unregisterSettingsHandlers,
} from '../../../../../src/main/adapters/in/ipc/SettingsIPC';
import {
  registerSystemHandlers,
  unregisterSystemHandlers,
} from '../../../../../src/main/adapters/in/ipc/SystemIPC';
import { registerTaskHandlers, unregisterTaskHandlers } from '../../../../../src/main/adapters/in/ipc/TaskIPC';
import {
  registerTemplateHandlers,
  unregisterTemplateHandlers,
} from '../../../../../src/main/adapters/in/ipc/TemplateIPC';
import {
  registerTopicHandlers,
  unregisterTopicHandlers,
} from '../../../../../src/main/adapters/in/ipc/TopicIPC';
import {
  registerVersionHandlers,
  unregisterVersionHandlers,
} from '../../../../../src/main/adapters/in/ipc/VersionIPC';

const electronMock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn(),
  };
  return {
    handlers,
    ipcMain,
    app: { getPath: vi.fn(() => '/tmp') },
    dialog: { showSaveDialog: vi.fn() },
    BrowserWindow: vi.fn(),
  };
});

vi.mock('electron', () => ({
  app: electronMock.app,
  BrowserWindow: electronMock.BrowserWindow,
  dialog: electronMock.dialog,
  ipcMain: electronMock.ipcMain,
}));

const execute = (value: unknown = {}) => ({ execute: vi.fn().mockResolvedValue(value) });

async function invoke(channel: string, request?: unknown) {
  const handler = electronMock.handlers.get(channel);
  expect(handler, `handler for ${channel}`).toBeDefined();
  return handler!({}, request);
}

function expectRegistered(channels: readonly string[]) {
  for (const channel of channels) {
    expect(electronMock.ipcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function));
  }
}

function expectUnregistered(channels: readonly string[]) {
  for (const channel of channels) {
    expect(electronMock.ipcMain.removeHandler).toHaveBeenCalledWith(channel);
  }
}

const date = new Date('2026-04-21T10:00:00Z');

describe('function-style IPC adapters', () => {
  beforeEach(() => {
    electronMock.handlers.clear();
    vi.clearAllMocks();
    electronMock.dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    setMainWindow(null);
  });

  it('registers AI channels and delegates requests to AI use cases', async () => {
    const aiUseCases = {
      askNotes: execute({ answer: 'answer', sources: [] }),
      summarizeNote: execute({ summary: 'summary' }),
      suggestLinks: execute({ suggestions: [] }),
      warmUpTranscriber: execute({ ready: true }),
    };

    registerAIHandlers({ aiUseCases } as any);

    expectRegistered(Object.values(AI_CHANNELS));
    await expect(invoke(AI_CHANNELS.ASK_NOTES, { query: 'q', workspaceId: 'ws-1' })).resolves.toEqual({
      success: true,
      data: { answer: 'answer', sources: [] },
    });
    await invoke(AI_CHANNELS.SUMMARIZE_NOTE, { noteId: 'note-1' });
    await invoke(AI_CHANNELS.SUGGEST_LINKS, { noteId: 'note-1' });
    await invoke(AI_CHANNELS.WARM_TRANSCRIBER);

    expect(aiUseCases.askNotes.execute).toHaveBeenCalledWith({ query: 'q', workspaceId: 'ws-1' });
    expect(aiUseCases.warmUpTranscriber.execute).toHaveBeenCalledWith();

    unregisterAIHandlers();
    expectUnregistered(Object.values(AI_CHANNELS));
  });

  it('serializes attachment dates and delegates attachment commands', async () => {
    const attachment = {
      id: 'att-1',
      noteId: 'note-1',
      filename: 'image.png',
      filePath: '/tmp/image.png',
      mimeType: 'image/png',
      size: 10,
      createdAt: date,
    };
    const attachmentUseCases = {
      addAttachment: vi.fn().mockResolvedValue(attachment),
      deleteAttachment: vi.fn().mockResolvedValue(undefined),
      getAttachments: vi.fn().mockResolvedValue([attachment]),
      uploadImage: vi.fn().mockResolvedValue({ markdownLink: '![x](image.png)', attachment }),
    };

    registerAttachmentHandlers({ attachmentUseCases } as any);

    expectRegistered(Object.values(ATTACHMENT_CHANNELS));
    await expect(
      invoke(ATTACHMENT_CHANNELS.ADD, {
        noteId: 'note-1',
        filePath: '/tmp/image.png',
        filename: 'image.png',
      }),
    ).resolves.toMatchObject({
      success: true,
      data: { id: 'att-1', createdAt: date.toISOString() },
    });
    await expect(invoke(ATTACHMENT_CHANNELS.DELETE, { id: 'att-1', deleteFile: true })).resolves.toEqual({
      success: true,
      data: { success: true },
    });
    await expect(invoke(ATTACHMENT_CHANNELS.GET_ALL, { noteId: 'note-1' })).resolves.toMatchObject({
      success: true,
      data: { attachments: [{ id: 'att-1', createdAt: date.toISOString() }] },
    });
    await expect(
      invoke(ATTACHMENT_CHANNELS.UPLOAD_IMAGE, {
        noteId: 'note-1',
        imageData: 'base64',
        filename: 'image.png',
      }),
    ).resolves.toMatchObject({
      success: true,
      data: { url: '![x](image.png)', attachment: { id: 'att-1', createdAt: date.toISOString() } },
    });

    expect(attachmentUseCases.addAttachment).toHaveBeenCalledWith(
      'note-1',
      '/tmp/image.png',
      'image.png',
    );

    unregisterAttachmentHandlers();
    expectUnregistered(Object.values(ATTACHMENT_CHANNELS));
  });

  it('delegates database maintenance channels', async () => {
    const deps = {
      getDatabaseStatus: execute({ ok: true }),
      vacuumDatabase: execute({ reclaimedBytes: 100 }),
      checkDatabaseIntegrity: execute({ ok: true }),
    };

    registerDatabaseHandlers(deps as any);

    await expect(invoke(DATABASE_CHANNELS.GET_STATUS)).resolves.toEqual({
      success: true,
      data: { ok: true },
    });
    await invoke(DATABASE_CHANNELS.VACUUM);
    await invoke(DATABASE_CHANNELS.CHECK_INTEGRITY);

    expect(deps.getDatabaseStatus.execute).toHaveBeenCalledWith();
    unregisterDatabaseHandlers();
    expectUnregistered([
      DATABASE_CHANNELS.GET_STATUS,
      DATABASE_CHANNELS.VACUUM,
      DATABASE_CHANNELS.CHECK_INTEGRITY,
    ]);
  });

  it('delegates daily review, status report, and template channels', async () => {
    const dailyReviewUseCases = { getDailyReview: execute({ today: true }) };
    const statusReportUseCases = { generate: execute({ markdown: '# Weekly' }) };
    const templateUseCases = {
      listTemplates: execute({ templates: [] }),
      createNoteFromTemplate: execute({ noteId: 'note-1' }),
    };

    registerDailyReviewHandlers({ dailyReviewUseCases } as any);
    registerStatusReportHandlers({ statusReportUseCases } as any);
    registerTemplateHandlers({ templateUseCases } as any);

    await invoke(DAILY_REVIEW_CHANNELS.GET, { workspaceId: 'ws-1', date: '2026-04-21' });
    await invoke(STATUS_REPORT_CHANNELS.GENERATE, { workspaceId: 'ws-1', windowDays: 7 });
    await invoke(TEMPLATE_CHANNELS.LIST, { workspaceId: 'ws-1' });
    await invoke(TEMPLATE_CHANNELS.CREATE_NOTE_FROM_TEMPLATE, {
      templateId: 'tpl-1',
      promptAnswers: { name: 'Ada' },
      workspaceId: 'ws-1',
      destinationFolder: 'People',
    });

    expect(dailyReviewUseCases.getDailyReview.execute).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      date: '2026-04-21',
    });
    expect(statusReportUseCases.generate.execute).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      windowDays: 7,
      promptTemplate: undefined,
    });
    expect(templateUseCases.createNoteFromTemplate.execute).toHaveBeenCalledWith({
      templateId: 'tpl-1',
      promptAnswers: { name: 'Ada' },
      workspaceId: 'ws-1',
      destinationFolder: 'People',
    });

    unregisterDailyReviewHandlers();
    unregisterStatusReportHandlers();
    unregisterTemplateHandlers();
    expectUnregistered(Object.values(DAILY_REVIEW_CHANNELS));
    expectUnregistered(Object.values(STATUS_REPORT_CHANNELS));
    expectUnregistered(Object.values(TEMPLATE_CHANNELS));
  });

  it('delegates graph and indexing channels', async () => {
    const graphUseCases = {
      getBacklinks: execute([{ id: 'backlink-1' }]),
      getForwardLinks: execute([{ id: 'forward-1' }]),
      getGraphData: execute({ nodes: [], edges: [] }),
    };
    const indexUseCases = {
      getStats: execute({ chunks: 1 }),
      indexNote: execute({ indexed: true }),
      rebuildAll: execute({ indexed: 3 }),
    };

    registerGraphHandlers({ graphUseCases } as any);
    registerIndexHandlers({ indexUseCases } as any);

    await expect(invoke(NOTE_CHANNELS.GET_BACKLINKS, { id: 'note-1' })).resolves.toEqual({
      success: true,
      data: { notes: [{ id: 'backlink-1' }] },
    });
    await invoke(NOTE_CHANNELS.GET_FORWARD_LINKS, { id: 'note-1' });
    await invoke(NOTE_CHANNELS.GET_GRAPH_DATA, { centerNoteId: 'note-1', depth: 2 });
    await invoke(INDEX_CHANNELS.GET_STATS, { workspaceId: 'ws-1' });
    await invoke(INDEX_CHANNELS.INDEX_NOTE, { noteId: 'note-1' });
    await invoke(INDEX_CHANNELS.REBUILD_ALL, { workspaceId: 'ws-1', force: true });

    expect(graphUseCases.getGraphData.execute).toHaveBeenCalledWith({
      centerNoteId: 'note-1',
      depth: 2,
    });
    expect(indexUseCases.indexNote.execute).toHaveBeenCalledWith({
      noteId: 'note-1',
      force: false,
    });

    unregisterGraphHandlers();
    unregisterIndexHandlers();
    expectUnregistered([
      NOTE_CHANNELS.GET_BACKLINKS,
      NOTE_CHANNELS.GET_FORWARD_LINKS,
      NOTE_CHANNELS.GET_GRAPH_DATA,
      ...Object.values(INDEX_CHANNELS),
    ]);
  });

  it('delegates journal, quick capture, quick note, and scratch channels', async () => {
    const journalUseCases = {
      openOrCreateForDate: vi.fn().mockResolvedValue({ noteId: 'note-1', created: true }),
      listRange: vi.fn().mockResolvedValue({ entries: [] }),
    };
    const appendToJournal = vi.fn().mockResolvedValue({ noteId: 'journal-1', appended: true });
    const transcribeVoiceCapture = vi.fn().mockResolvedValue({ text: 'hello', durationMs: 100 });
    const quickNoteUseCases = { createInSlot: vi.fn().mockResolvedValue({ noteId: 'quick-1' }) };
    const scratchUseCases = {
      pickScratchFile: execute({ path: '/tmp/a.md' }),
      readScratchFile: execute({ path: '/tmp/a.md', name: 'a.md', content: 'Hello' }),
      writeScratchFile: execute({ path: '/tmp/a.md' }),
    };

    registerJournalHandlers({ journalUseCases } as any);
    registerQuickCaptureHandlers({ appendToJournal, transcribeVoiceCapture });
    registerQuickNoteHandlers({ quickNoteUseCases } as any);
    registerScratchHandlers({ scratchUseCases } as any);

    await invoke(JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE, {
      date: '2026-04-21',
      workspaceId: 'ws-1',
    });
    await invoke(JOURNAL_CHANNELS.LIST_RANGE, { limit: 7, workspaceId: 'ws-1' });
    await invoke(QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL, { text: 'capture', workspaceId: 'ws-1' });
    await invoke(QUICK_CAPTURE_CHANNELS.TRANSCRIBE_VOICE, {
      wav: new Uint8Array([1, 2, 3]),
      workspaceId: 'ws-1',
    });
    await invoke(QUICK_NOTE_CHANNELS.CREATE_IN_SLOT, { slot: 'work', title: 'Inbox' });
    await invoke(SCRATCH_CHANNELS.PICK);
    await invoke(SCRATCH_CHANNELS.READ, { path: '/tmp/a.md' });
    await invoke(SCRATCH_CHANNELS.WRITE, { path: '/tmp/a.md', content: 'Updated' });

    expect(journalUseCases.openOrCreateForDate).toHaveBeenCalledWith({
      date: '2026-04-21',
      workspaceId: 'ws-1',
    });
    expect(appendToJournal).toHaveBeenCalledWith('capture', 'ws-1');
    expect(transcribeVoiceCapture).toHaveBeenCalledWith({
      wav: new Uint8Array([1, 2, 3]),
      workspaceId: 'ws-1',
    });
    expect(quickNoteUseCases.createInSlot).toHaveBeenCalledWith({ slot: 'work', title: 'Inbox' });
    expect(scratchUseCases.writeScratchFile.execute).toHaveBeenCalledWith({
      path: '/tmp/a.md',
      content: 'Updated',
    });

    unregisterJournalHandlers();
    unregisterQuickCaptureHandlers();
    unregisterQuickNoteHandlers();
    unregisterScratchHandlers();
    expectUnregistered(Object.values(JOURNAL_CHANNELS));
    expectUnregistered(Object.values(QUICK_CAPTURE_CHANNELS));
    expectUnregistered(Object.values(QUICK_NOTE_CHANNELS));
    expectUnregistered(Object.values(SCRATCH_CHANNELS));
  });

  it('delegates meeting and performance channels', async () => {
    const meetingUseCases = {
      reserveRecordingSlot: execute({ recordingId: 'rec-1' }),
      appendRecordingAudio: execute({ appended: true }),
      finalizeRecording: execute({ recordingId: 'rec-1', transcript: 'done' }),
      listMeetingRecordings: execute({ recordings: [] }),
      getMeetingRecording: execute({ recordingId: 'rec-1' }),
      deleteMeetingRecording: execute({ deleted: true }),
      resummarizeMeeting: execute({ summary: 'summary' }),
      sendToJournal: execute({ noteId: 'journal-1' }),
    };
    const windowRef = { id: 1 } as any;
    const performanceDeps = {
      getSnapshot: vi.fn().mockReturnValue({ cpu: { usage: 1 } }),
      getMemoryMetrics: vi.fn().mockReturnValue({ heapUsed: 1 }),
      getCPUMetrics: vi.fn().mockReturnValue({ usage: 1 }),
      getIPCMetrics: vi.fn().mockReturnValue({ handlers: [] }),
      getDatabaseMetrics: vi.fn().mockReturnValue({ queries: [] }),
      getStartupMetrics: vi.fn().mockReturnValue({ totalMs: 10 }),
      clearHistory: vi.fn(),
      getRendererMetrics: vi.fn().mockResolvedValue({ paints: 1 }),
    };

    registerMeetingHandlers({ meetingUseCases } as any);
    setMainWindow(windowRef);
    registerPerformanceHandlers(performanceDeps as any);

    await invoke(MEETING_CHANNELS.RESERVE_SLOT, { workspaceId: 'ws-1', title: 'Sync' });
    await invoke(MEETING_CHANNELS.APPEND_AUDIO, {
      recordingId: 'rec-1',
      chunk: new ArrayBuffer(1),
    });
    await invoke(MEETING_CHANNELS.FINALIZE, { recordingId: 'rec-1' });
    await invoke(MEETING_CHANNELS.LIST, { workspaceId: 'ws-1', limit: 10 });
    await invoke(MEETING_CHANNELS.GET, { recordingId: 'rec-1' });
    await invoke(MEETING_CHANNELS.DELETE, { recordingId: 'rec-1' });
    await invoke(MEETING_CHANNELS.RESUMMARIZE, { recordingId: 'rec-1', promptTemplate: 'short' });
    await invoke(MEETING_CHANNELS.SEND_TO_JOURNAL, { recordingId: 'rec-1', journalDate: '2026-04-21' });
    await expect(invoke(PERFORMANCE_CHANNELS.GET_SNAPSHOT, 500)).resolves.toMatchObject({
      success: true,
      data: { cpu: { usage: 1 }, renderer: { paints: 1 } },
    });
    await invoke(PERFORMANCE_CHANNELS.GET_MEMORY);
    await invoke(PERFORMANCE_CHANNELS.GET_CPU);
    await invoke(PERFORMANCE_CHANNELS.GET_IPC_STATS, 500);
    await invoke(PERFORMANCE_CHANNELS.GET_DB_STATS, 500);
    await invoke(PERFORMANCE_CHANNELS.GET_STARTUP);
    await invoke(PERFORMANCE_CHANNELS.CLEAR_HISTORY);

    expect(meetingUseCases.finalizeRecording.execute).toHaveBeenCalledWith({
      recordingId: 'rec-1',
      durationMs: 0,
    });
    expect(performanceDeps.getSnapshot).toHaveBeenCalledWith(500);
    expect(performanceDeps.getRendererMetrics).toHaveBeenCalledWith(windowRef);
    expect(performanceDeps.clearHistory).toHaveBeenCalledWith();

    unregisterMeetingHandlers();
    unregisterPerformanceHandlers();
    expectUnregistered(Object.values(MEETING_CHANNELS));
    expectUnregistered(Object.values(PERFORMANCE_CHANNELS));
  });

  it('delegates system, task, and version channels', async () => {
    const task = {
      text: 'do it',
      completed: false,
      noteId: 'note-1',
      taskIndex: 0,
      createdAt: date,
      updatedAt: date,
    };
    const systemDeps = {
      getSystemFonts: execute({ fonts: ['Inter'] }),
      getMicAccessStatus: execute({ status: 'granted' }),
      requestMicAccess: execute({ status: 'granted' }),
      getSystemAudioAccess: execute({ status: 'granted' }),
      requestSystemAudioAccess: execute({ status: 'granted' }),
      openExternal: execute({ opened: true }),
    };
    const taskUseCases = {
      getAllTasks: execute([task]),
      getNoteTasks: execute([task]),
      updateTaskState: execute(undefined),
      toggleTask: execute(undefined),
    };
    const version = {
      id: 'ver-1',
      noteId: 'note-1',
      versionNumber: 1,
      title: 'Title',
      content: 'Content',
      createdAt: date,
    };
    const versionUseCases = {
      getVersions: execute([version]),
      getVersion: execute(version),
      createVersion: execute(version),
      restoreVersion: execute(undefined),
    };
    const noteUseCases = { getNote: execute({ note: { id: 'note-1', title: 'Title' } }) };

    registerSystemHandlers(systemDeps as any);
    registerTaskHandlers({ taskUseCases } as any);
    registerVersionHandlers({ versionUseCases, noteUseCases } as any);

    await invoke(SYSTEM_CHANNELS.GET_FONTS);
    await invoke(SYSTEM_CHANNELS.GET_MIC_ACCESS_STATUS);
    await invoke(SYSTEM_CHANNELS.REQUEST_MIC_ACCESS);
    await invoke(SYSTEM_CHANNELS.GET_SYSTEM_AUDIO_ACCESS);
    await invoke(SYSTEM_CHANNELS.REQUEST_SYSTEM_AUDIO_ACCESS);
    await invoke(SYSTEM_CHANNELS.OPEN_EXTERNAL, { url: 'https://example.com' });
    await expect(invoke(NOTE_CHANNELS.GET_ALL_TODOS)).resolves.toMatchObject({
      success: true,
      data: [{ text: 'do it', createdAt: date.toISOString(), updatedAt: date.toISOString() }],
    });
    await invoke(NOTE_CHANNELS.GET_NOTE_TODOS, { noteId: 'note-1' });
    await invoke(NOTE_CHANNELS.UPDATE_TASK_STATE, {
      noteId: 'note-1',
      taskIndex: 0,
      newState: 'done',
    });
    await invoke(NOTE_CHANNELS.TOGGLE_TASK, { noteId: 'note-1', taskIndex: 0 });
    await expect(invoke(NOTE_CHANNELS.GET_VERSIONS, { noteId: 'note-1' })).resolves.toMatchObject({
      success: true,
      data: { versions: [{ id: 'ver-1', createdAt: date.toISOString(), sizeBytes: 7 }] },
    });
    await invoke(NOTE_CHANNELS.GET_VERSION, 'ver-1');
    await invoke(NOTE_CHANNELS.CREATE_VERSION, 'note-1');
    await invoke(NOTE_CHANNELS.RESTORE_VERSION, { id: 'note-1', versionId: 'ver-1' });

    expect(systemDeps.openExternal.execute).toHaveBeenCalledWith({ url: 'https://example.com' });
    expect(taskUseCases.updateTaskState.execute).toHaveBeenCalledWith('note-1', 0, 'done');
    expect(versionUseCases.restoreVersion.execute).toHaveBeenCalledWith('note-1', 'ver-1');

    unregisterSystemHandlers();
    unregisterTaskHandlers();
    unregisterVersionHandlers();
    expectUnregistered(Object.values(SYSTEM_CHANNELS));
    expectUnregistered([
      NOTE_CHANNELS.GET_ALL_TODOS,
      NOTE_CHANNELS.GET_NOTE_TODOS,
      NOTE_CHANNELS.UPDATE_TASK_STATE,
      NOTE_CHANNELS.TOGGLE_TASK,
      NOTE_CHANNELS.GET_VERSIONS,
      NOTE_CHANNELS.GET_VERSION,
      NOTE_CHANNELS.CREATE_VERSION,
      NOTE_CHANNELS.RESTORE_VERSION,
    ]);
  });

  it('delegates settings channels across legacy settings, typed preferences, shortcuts, and AI keys', async () => {
    const deps = {
      getSetting: execute({ key: 'legacy', value: 'yes' }),
      setSetting: execute(undefined),
      getAllSettings: execute({ settings: {} }),
      getAppearanceSettings: execute({ theme: 'system', accentColor: 'stone' }),
      setTheme: execute(undefined),
      setAccentColor: execute(undefined),
      updateFontSettings: execute(undefined),
      resetFontSettings: execute(undefined),
      getEditorSettings: execute({ vimMode: false }),
      updateEditorSettings: execute({ vimMode: true }),
      resetEditorSettings: execute({ vimMode: false }),
      getShortcuts: execute({ global: {}, editor: {} }),
      setShortcut: execute({ binding: { key: 'K', modifiers: ['Meta'] } }),
      resetShortcut: execute(undefined),
      resetAllShortcuts: execute(undefined),
      getAI: execute({ provider: 'openai' }),
      updateAI: execute({ provider: 'groq' }),
      resetAI: execute({ provider: 'openai' }),
      getAIProviderKeys: execute({ openai: true }),
      setAIProviderKey: execute(undefined),
      deleteAIProviderKey: execute(undefined),
    };

    registerSettingsHandlers(deps as any);

    expectRegistered(Object.values(SETTINGS_CHANNELS));
    await invoke(SETTINGS_CHANNELS.GET, { key: 'legacy' });
    await invoke(SETTINGS_CHANNELS.SET, { key: 'legacy', value: 'yes' });
    await invoke(SETTINGS_CHANNELS.GET_ALL);
    await invoke(SETTINGS_CHANNELS.GET_APPEARANCE);
    await invoke(SETTINGS_CHANNELS.SET_THEME, { theme: 'dark' });
    await invoke(SETTINGS_CHANNELS.SET_ACCENT_COLOR, { accentColor: 'blue' });
    await invoke(SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS, { fontSettings: { bodyFont: 'Inter' } });
    await invoke(SETTINGS_CHANNELS.RESET_FONT_SETTINGS);
    await invoke(SETTINGS_CHANNELS.GET_EDITOR);
    await invoke(SETTINGS_CHANNELS.UPDATE_EDITOR, { editor: { vimMode: true } });
    await invoke(SETTINGS_CHANNELS.RESET_EDITOR);
    await invoke(SETTINGS_CHANNELS.GET_SHORTCUTS);
    await invoke(SETTINGS_CHANNELS.SET_SHORTCUT, {
      scope: 'global',
      action: 'commandCenter.open',
      binding: { key: 'K', modifiers: ['Meta'] },
    });
    await invoke(SETTINGS_CHANNELS.RESET_SHORTCUT, {
      scope: 'global',
      action: 'commandCenter.open',
    });
    await invoke(SETTINGS_CHANNELS.RESET_ALL_SHORTCUTS);
    await invoke(SETTINGS_CHANNELS.GET_AI);
    await invoke(SETTINGS_CHANNELS.UPDATE_AI, { ai: { provider: 'groq' } });
    await invoke(SETTINGS_CHANNELS.RESET_AI);
    await invoke(SETTINGS_CHANNELS.GET_AI_PROVIDER_KEYS);
    await invoke(SETTINGS_CHANNELS.SET_AI_PROVIDER_KEY, { provider: 'openai', apiKey: 'sk-test' });
    await invoke(SETTINGS_CHANNELS.DELETE_AI_PROVIDER_KEY, { provider: 'openai' });

    expect(deps.setTheme.execute).toHaveBeenCalledWith({ theme: 'dark' });
    expect(deps.updateFontSettings.execute).toHaveBeenCalledWith({
      fontSettings: { bodyFont: 'Inter' },
    });
    expect(deps.setShortcut.execute).toHaveBeenCalledWith({
      scope: 'global',
      action: 'commandCenter.open',
      binding: { key: 'K', modifiers: ['Meta'] },
    });
    expect(deps.setAIProviderKey.execute).toHaveBeenCalledWith({
      provider: 'openai',
      apiKey: 'sk-test',
    });

    unregisterSettingsHandlers();
    expectUnregistered(Object.values(SETTINGS_CHANNELS));
  });

  it('delegates export channels without writing when save dialog is cancelled', async () => {
    const exportUseCases = {
      exportHtml: execute({ content: '<h1>Hello</h1>', filename: 'hello.html' }),
      exportPdf: execute({ content: Buffer.from('pdf'), filename: 'hello.pdf' }),
      exportMarkdown: execute({ content: '# Hello', filename: 'hello.md' }),
    };

    registerExportHandlers({ exportUseCases } as any);

    await expect(
      invoke(NOTE_CHANNELS.EXPORT_HTML, {
        id: 'note-1',
        renderedHtml: '<h1>Hello</h1>',
        title: 'Hello',
      }),
    ).resolves.toEqual({ success: true, data: { html: '<h1>Hello</h1>', path: '' } });
    await expect(invoke(NOTE_CHANNELS.EXPORT_PDF, { id: 'note-1' })).resolves.toEqual({
      success: true,
      data: { path: '' },
    });
    await expect(invoke(NOTE_CHANNELS.EXPORT_MARKDOWN, { id: 'note-1' })).resolves.toEqual({
      success: true,
      data: { markdown: '# Hello', path: '' },
    });

    expect(exportUseCases.exportHtml.execute).toHaveBeenCalledWith('note-1', {
      renderedHtml: '<h1>Hello</h1>',
      title: 'Hello',
    });
    expect(electronMock.dialog.showSaveDialog).toHaveBeenCalledTimes(3);

    unregisterExportHandlers();
    expectUnregistered([NOTE_CHANNELS.EXPORT_HTML, NOTE_CHANNELS.EXPORT_PDF, NOTE_CHANNELS.EXPORT_MARKDOWN]);
  });

  it('delegates git channels and maps git response shapes', async () => {
    const deps = {
      getGitStatus: execute({
        isRepo: true,
        branch: 'main',
        remote: 'git@example.com:repo.git',
        ahead: 1,
        behind: 2,
        staged: ['a.md'],
        modified: ['b.md'],
        untracked: ['c.md'],
        lastSyncAt: 'soon',
        hasChanges: true,
      }),
      initGitRepo: execute({ success: true }),
      gitCommit: execute({ hash: 'abc', message: 'commit', date }),
      gitPull: execute({ success: true }),
      gitPush: execute({ success: true }),
      gitSync: execute({ pushed: true }),
      setGitRemote: execute({ success: true }),
      getGitCommits: execute({ commits: [{ hash: 'abc', message: 'commit', date }] }),
    };

    registerGitHandlers(deps as any);

    await expect(invoke(GIT_CHANNELS.GET_STATUS, { workspaceId: 'ws-1' })).resolves.toMatchObject({
      success: true,
      data: { isRepo: true, hasRemote: true, staged: 1, unstaged: 1, untracked: 1 },
    });
    await invoke(GIT_CHANNELS.INIT, { workspaceId: 'ws-1' });
    await expect(invoke(GIT_CHANNELS.COMMIT, { workspaceId: 'ws-1', message: 'commit' })).resolves.toMatchObject({
      success: true,
      data: { hash: 'abc', date: date.toISOString() },
    });
    await invoke(GIT_CHANNELS.PULL, { workspaceId: 'ws-1' });
    await invoke(GIT_CHANNELS.PUSH, { workspaceId: 'ws-1' });
    await invoke(GIT_CHANNELS.SYNC, { workspaceId: 'ws-1', message: 'sync' });
    await invoke(GIT_CHANNELS.SET_REMOTE, { workspaceId: 'ws-1', url: 'git@example.com:repo.git' });
    await expect(invoke(GIT_CHANNELS.GET_COMMITS, { workspaceId: 'ws-1', limit: 5 })).resolves.toMatchObject({
      success: true,
      data: { commits: [{ hash: 'abc', date: date.toISOString() }] },
    });

    expect(deps.gitSync.execute).toHaveBeenCalledWith({ workspaceId: 'ws-1', message: 'sync' });
    unregisterGitHandlers();
    expectUnregistered(Object.values(GIT_CHANNELS));
  });

  it('delegates topic channels and serializes note-topic dates', async () => {
    const topicUseCases = {
      initialize: execute({ initialized: true }),
      getAllTopics: execute([{ id: 'topic-1' }]),
      getTopicById: execute({ id: 'topic-1' }),
      createTopic: execute({ id: 'topic-1' }),
      updateTopic: execute({ id: 'topic-1' }),
      deleteTopic: execute(undefined),
      assignTopicToNote: execute(undefined),
      removeTopicFromNote: execute(undefined),
      classifyNote: execute({ topics: [] }),
      classifyAllNotes: execute({ classified: 1 }),
      semanticSearch: execute([{ id: 'note-1' }]),
      getSimilarNotes: execute([{ id: 'note-2' }]),
      recomputeCentroids: execute(undefined),
      getEmbeddingStatus: execute({ ready: true }),
      suggestTopics: execute([{ name: 'Idea' }]),
      adoptSuggestedTopic: execute({ topicId: 'topic-1' }),
      getNotesForTopic: execute([{ id: 'note-1' }]),
      getTopicsForNote: execute([{ id: 'topic-1', createdAt: date }]),
    };

    registerTopicHandlers({ topicUseCases } as any);

    await invoke(TOPIC_CHANNELS.INITIALIZE);
    await expect(invoke(TOPIC_CHANNELS.GET_ALL)).resolves.toEqual({
      success: true,
      data: { topics: [{ id: 'topic-1' }] },
    });
    await invoke(TOPIC_CHANNELS.GET_BY_ID, { id: 'topic-1' });
    await invoke(TOPIC_CHANNELS.CREATE, { name: 'Topic' });
    await invoke(TOPIC_CHANNELS.UPDATE, { id: 'topic-1', name: 'Renamed' });
    await invoke(TOPIC_CHANNELS.DELETE, { id: 'topic-1' });
    await invoke(TOPIC_CHANNELS.ASSIGN_TO_NOTE, { noteId: 'note-1', topicId: 'topic-1' });
    await invoke(TOPIC_CHANNELS.REMOVE_FROM_NOTE, { noteId: 'note-1', topicId: 'topic-1' });
    await invoke(TOPIC_CHANNELS.CLASSIFY_NOTE, { noteId: 'note-1', force: true });
    await invoke(TOPIC_CHANNELS.CLASSIFY_ALL, { excludeJournal: true });
    await invoke(TOPIC_CHANNELS.RECLASSIFY_ALL, { excludeJournal: true });
    await invoke(TOPIC_CHANNELS.SEMANTIC_SEARCH, { query: 'topic', limit: 5 });
    await invoke(TOPIC_CHANNELS.GET_SIMILAR_NOTES, { noteId: 'note-1', limit: 5 });
    await invoke(TOPIC_CHANNELS.RECOMPUTE_CENTROIDS);
    await invoke(TOPIC_CHANNELS.GET_EMBEDDING_STATUS);
    await invoke(TOPIC_CHANNELS.GET_SUGGESTIONS, { workspaceId: 'ws-1' });
    await invoke(TOPIC_CHANNELS.ADOPT_SUGGESTION, { name: 'Idea', noteIds: ['note-1'] });
    await invoke(TOPIC_CHANNELS.GET_NOTES_BY_TOPIC, { topicId: 'topic-1', limit: 10 });
    await expect(invoke(TOPIC_CHANNELS.GET_TOPICS_FOR_NOTE, { noteId: 'note-1' })).resolves.toMatchObject({
      success: true,
      data: { topics: [{ id: 'topic-1', createdAt: date.toISOString() }] },
    });

    expect(topicUseCases.recomputeCentroids.execute).toHaveBeenCalledWith();
    expect(topicUseCases.classifyAllNotes.execute).toHaveBeenCalledWith({
      force: true,
      excludeJournal: true,
    });

    unregisterTopicHandlers();
    expectUnregistered(Object.values(TOPIC_CHANNELS));
  });
});
