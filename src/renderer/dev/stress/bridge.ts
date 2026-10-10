import {
  ATTACHMENT_CHANNELS,
  DAILY_REVIEW_CHANNELS,
  EVENTS,
  GIT_CHANNELS,
  INDEX_CHANNELS,
  JOURNAL_CHANNELS,
  MEETING_CHANNELS,
  NOTE_CHANNELS,
  NOTEBOOK_CHANNELS,
  SEARCH_CHANNELS,
  SETTINGS_CHANNELS,
  SYSTEM_CHANNELS,
  TAG_CHANNELS,
  TEMPLATE_CHANNELS,
  TOPIC_CHANNELS,
  WORKSPACE_CHANNELS,
} from '@shared/constants/ipcChannels';
import type { DailyReviewIntegrationResult, IpcResponse, Note } from '@shared/types';
import { DEFAULT_APP_CONFIG } from '@shared/types/settings';
import { createStressFixture, type StressScenario, type StressTreeNode } from './fixtures';

type Payload = Record<string, unknown>;
type Listener = (...args: unknown[]) => void;

const success = <T>(data: T): IpcResponse<T> => ({ success: true, data });
const failure = (message: string, code = 'STRESS_PREVIEW_ONLY'): IpcResponse<never> => ({
  success: false,
  error: { code, message },
});

function folderCounts(tree: StressTreeNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const count = (node: StressTreeNode): number => {
    if (node.type === 'file') return 1;
    const total = (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
    counts[node.relativePath] = total;
    return total;
  };
  tree.forEach(count);
  return counts;
}

/**
 * A complete replacement for IPC, installed before importing the real App.
 * This module never retains or calls the desktop/browser transport. Unknown
 * operations fail explicitly so a preview action cannot claim a real write.
 */
export function installStressBridge(initialScenario: StressScenario) {
  if (!import.meta.env.DEV) throw new Error('The stress preview is development-only.');

  let scenario = initialScenario;
  let fixture = createStressFixture(scenario);
  const previewConfig = () => {
    const next = structuredClone(DEFAULT_APP_CONFIG);
    next.appearance.theme =
      new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
    return next;
  };
  let config = previewConfig();
  const contents = new Map<string, string>();
  const settings = new Map<string, unknown>();
  const listeners = new Map<string, Set<Listener>>();
  const pending = new Set<(response: IpcResponse<unknown>) => void>();

  const emit = (channel: string, value: unknown) => {
    listeners.get(channel)?.forEach((listener) => listener(value));
  };

  const contentFor = (note: Note): string => {
    const edited = contents.get(note.id);
    if (edited !== undefined) return edited;
    const journal = fixture.snapshot.todayJournal;
    if (journal.noteId === note.id) return journal.contentPreview ?? '';
    const tasks = fixture.snapshot.openTasks.filter((task) => task.noteId === note.id);
    return [
      `# ${note.title ?? 'Untitled'}`,
      '',
      'This is an isolated development fixture. Changes stay in this preview.',
      '',
      ...tasks.map((task) => `- [${task.checked ? 'x' : ' '}] ${task.text}`),
    ].join('\n');
  };

  const integrations = (): DailyReviewIntegrationResult[] => {
    const status = scenario === 'denied' ? 'denied' : 'connected';
    const message =
      status === 'denied'
        ? 'Access was denied. Allow Stone to read this source in System Settings, then try again.'
        : undefined;
    return [
      {
        source: 'calendar',
        status,
        message,
        data: { events: status === 'denied' ? [] : (fixture.snapshot.calendarEvents ?? []) },
      },
      {
        source: 'mail',
        status,
        message,
        data: {
          unreadCount: status === 'denied' ? 0 : (fixture.snapshot.mailUnreadCount ?? 0),
          messages: status === 'denied' ? [] : (fixture.snapshot.mailMessages ?? []),
        },
      },
      {
        source: 'linear',
        status,
        message,
        data: { issues: status === 'denied' ? [] : (fixture.snapshot.linearIssues ?? []) },
      },
    ];
  };

  const meetingRecordings = () =>
    fixture.snapshot.todayMeetings.map((meeting) => ({
      ...meeting,
      workspaceId: fixture.workspace.id,
      audioPath: null,
      transcriptText: meeting.status === 'ready' ? meeting.summary : null,
      transcriptSegments: [],
      promptUsed: null,
      journalDate: meeting.inJournal ? fixture.snapshot.date : null,
      error: meeting.status === 'failed' ? 'The recording could not be transcribed.' : null,
      updatedAt: meeting.createdAt,
    }));

  const invoke = async (channel: string, args: unknown[]): Promise<IpcResponse<unknown>> => {
    const payload = (args[0] ?? {}) as Payload;
    switch (channel) {
      case WORKSPACE_CHANNELS.GET_ALL:
        return success({ workspaces: [fixture.workspace] });
      case WORKSPACE_CHANNELS.GET_ACTIVE:
        return success({ workspace: fixture.workspace });
      case WORKSPACE_CHANNELS.GET_DEFAULT_PATH:
        return success({ path: fixture.workspace.folderPath });
      case WORKSPACE_CHANNELS.SCAN:
        return success({ structure: fixture.tree, counts: folderCounts(fixture.tree) });
      case WORKSPACE_CHANNELS.SYNC:
        // Bootstrap reconciles the fixture with itself; no files are accessed.
        return success({
          workspaceId: fixture.workspace.id,
          notebooks: { created: 0, updated: 0, errors: [] },
          notes: { created: 0, updated: 0, deleted: 0, embedded: 0, errors: [] },
        });
      case NOTEBOOK_CHANNELS.GET_ALL:
        return success({ notebooks: [] });
      case TAG_CHANNELS.GET_ALL:
        return success({ tags: [] });
      case NOTE_CHANNELS.GET_ALL: {
        const notes = fixture.notes.filter((note) => {
          if (payload.notebookId && note.notebookId !== payload.notebookId) return false;
          if (payload.folderPath && !note.filePath?.startsWith(`${payload.folderPath}/`)) {
            return false;
          }
          if (payload.isFavorite && !note.isFavorite) return false;
          if (payload.isPinned && !note.isPinned) return false;
          if (payload.isArchived !== undefined && note.isArchived !== payload.isArchived) {
            return false;
          }
          return true;
        });
        return success({ notes, total: notes.length });
      }
      case NOTE_CHANNELS.GET:
      case NOTE_CHANNELS.GET_CONTENT:
      case NOTE_CHANNELS.GET_BY_PATH: {
        const path = String(payload.filePath ?? payload.path ?? '').replace(
          `${fixture.workspace.folderPath}/`,
          '',
        );
        const note = fixture.notes.find((candidate) =>
          channel === NOTE_CHANNELS.GET_BY_PATH
            ? candidate.filePath === path
            : candidate.id === payload.id,
        );
        if (!note) return failure('This note is not part of the selected fixture.', 'NOT_FOUND');
        return success(
          channel === NOTE_CHANNELS.GET_CONTENT ? { content: contentFor(note) } : note,
        );
      }
      case NOTE_CHANNELS.UPDATE: {
        const note = fixture.notes.find((candidate) => candidate.id === payload.id);
        if (!note) return failure('This note is not part of the selected fixture.', 'NOT_FOUND');
        if (typeof payload.content === 'string') contents.set(note.id, payload.content);
        if (typeof payload.title === 'string') note.title = payload.title;
        emit(EVENTS.NOTE_UPDATED, { note });
        return success(note);
      }
      case NOTE_CHANNELS.GET_ALL_TODOS:
        return success(fixture.snapshot.openTasks);
      case NOTE_CHANNELS.GET_NOTE_TODOS:
        return success(fixture.snapshot.openTasks.filter((task) => task.noteId === payload.noteId));
      case NOTE_CHANNELS.GET_BACKLINKS:
      case NOTE_CHANNELS.GET_FORWARD_LINKS:
        return success({ notes: [] });
      case NOTE_CHANNELS.GET_VERSIONS:
        return success({ versions: [] });
      case ATTACHMENT_CHANNELS.GET_ALL:
        return success({ attachments: [] });
      case DAILY_REVIEW_CHANNELS.GET:
        if (scenario === 'loading') {
          return new Promise((resolve) => pending.add(resolve));
        }
        if (scenario === 'error') {
          return failure(
            'Today could not be loaded because the workspace database is temporarily unavailable. Your notes are still on disk; try again after the workspace reconnects.',
            'STRESS_SIMULATED_FAILURE',
          );
        }
        return success(fixture.snapshot);
      case DAILY_REVIEW_CHANNELS.LOAD_INTEGRATIONS:
        return success({ results: integrations(), snapshot: fixture.snapshot });
      case DAILY_REVIEW_CHANNELS.LOAD_INTEGRATION: {
        const result = integrations().find((entry) => entry.source === payload.source);
        return result
          ? success({ result, snapshot: fixture.snapshot })
          : failure('Unknown integration fixture.');
      }
      case DAILY_REVIEW_CHANNELS.LIST_CALENDARS:
        return success({
          status: scenario === 'denied' ? 'denied' : 'connected',
          calendars: Array.from(
            new Set((fixture.snapshot.calendarEvents ?? []).map((event) => event.calendar)),
          ).map((title, index) => ({ id: `stress-calendar-${index}`, title, source: 'Preview' })),
        });
      case DAILY_REVIEW_CHANNELS.SUMMARIZE:
        if (payload.saveToJournal) {
          return failure('Saving summaries is disabled in this isolated preview.');
        }
        return success({
          summary: [
            '## Preview day summary',
            '',
            `You have ${fixture.snapshot.openTasks.length} open tasks and ${fixture.snapshot.todayMeetings.length} meeting recordings.`,
            '',
            ...fixture.snapshot.openTasks.slice(0, 6).map((task) => `- ${task.text}`),
            '',
            'This summary is fixture data; no AI service was called.',
          ].join('\n'),
          journalNoteId: null,
        });
      case JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE: {
        const journal = fixture.snapshot.todayJournal;
        if (journal.exists && journal.noteId && payload.date === journal.date) {
          return success({ noteId: journal.noteId, created: false });
        }
        return failure('Creating a journal is disabled in this isolated preview.');
      }
      case JOURNAL_CHANNELS.LIST_RANGE:
        return success({
          entries: [
            {
              ...fixture.snapshot.todayJournal,
              content: fixture.snapshot.todayJournal.contentPreview,
            },
          ],
        });
      case MEETING_CHANNELS.LIST:
        return success({ recordings: meetingRecordings(), nextCursor: null });
      case MEETING_CHANNELS.GET:
        return success({
          recording:
            meetingRecordings().find((meeting) => meeting.id === payload.recordingId) ?? null,
        });
      case MEETING_CHANNELS.TRAY_SET_STATE:
        // The browser preview has no tray; accept only its local idle state.
        return payload.phase === 'idle'
          ? success(undefined)
          : failure('Recording and desktop tray controls are disabled in this preview.');
      case SEARCH_CHANNELS.FULL_TEXT:
      case SEARCH_CHANNELS.HYBRID:
      case SEARCH_CHANNELS.SEMANTIC:
      case SEARCH_CHANNELS.BY_DATE_RANGE:
      case SEARCH_CHANNELS.BY_TAG: {
        const query = String(payload.query ?? '').toLocaleLowerCase();
        const matching = fixture.notes.filter((note) =>
          (note.title ?? '').toLocaleLowerCase().includes(query),
        );
        return success({
          results: matching.slice(0, Number(payload.limit ?? 20)).map((note) => ({
            id: note.id,
            title: note.title ?? 'Untitled',
            notebookId: note.notebookId,
            relevance: 1,
          })),
          total: matching.length,
          query_time_ms: 0,
        });
      }
      case SEARCH_CHANNELS.GET_RELATED:
        return success({ results: [] });
      case TEMPLATE_CHANNELS.LIST:
        return success({ templates: [] });
      case TOPIC_CHANNELS.GET_EMBEDDING_STATUS:
        return success({
          ready: false,
          totalNotes: fixture.notes.length,
          embeddedNotes: 0,
          pendingNotes: fixture.notes.length,
        });
      case INDEX_CHANNELS.GET_STATS:
        return success({
          workspaceId: fixture.workspace.id,
          totalNotes: fixture.notes.length,
          indexedNotes: 0,
          pendingNotes: fixture.notes.length,
          failedNotes: 0,
          chunkCount: 0,
        });
      case GIT_CHANNELS.GET_STATUS:
        return success({
          isRepo: true,
          branch:
            scenario === 'worst'
              ? 'research/international-enterprise-rollout-october-2026'
              : 'main',
          hasRemote: scenario !== 'denied',
          remoteUrl: scenario === 'denied' ? null : 'https://example.com/northwind/notes.git',
          ahead: scenario === 'worst' || scenario === 'huge' ? 1284 : scenario === 'one' ? 1 : 0,
          behind: scenario === 'worst' || scenario === 'huge' ? 42 : scenario === 'one' ? 1 : 0,
          staged: 0,
          unstaged: scenario === 'worst' || scenario === 'huge' ? 1284 : scenario === 'one' ? 1 : 0,
          untracked: 0,
          hasChanges: ['worst', 'huge', 'one'].includes(scenario),
          lastSyncAt: null,
        });
      case GIT_CHANNELS.GET_COMMITS:
        return success({ commits: [] });
      case SETTINGS_CHANNELS.GET:
        return success({ value: settings.get(String(payload.key)) ?? null });
      case SETTINGS_CHANNELS.SET:
        settings.set(String(payload.key), payload.value);
        return success(undefined);
      case SETTINGS_CHANNELS.GET_ALL:
        return success({ settings: [] });
      case SETTINGS_CHANNELS.GET_APPEARANCE:
        return success(config.appearance);
      case SETTINGS_CHANNELS.GET_EDITOR:
        return success(config.editor);
      case SETTINGS_CHANNELS.GET_SHORTCUTS:
        return success(config.shortcuts);
      case SETTINGS_CHANNELS.GET_AI:
        return success(config.ai);
      case SETTINGS_CHANNELS.GET_AI_PROVIDER_KEYS:
        return success([]);
      case SETTINGS_CHANNELS.GET_MEETINGS:
        return success(config.meetings);
      case SETTINGS_CHANNELS.GET_INTEGRATIONS:
        return success(config.integrations);
      case SETTINGS_CHANNELS.GET_QUICK_CAPTURE_SHORTCUT:
        return success({ shortcut: '', registered: false });
      case SETTINGS_CHANNELS.GET_ONBOARDING:
        return success({
          completed: true,
          completedAt: `${fixture.snapshot.date}T08:00:00.000Z`,
          steps: { workspace: true, permissions: true, ai: true, models: true, shortcuts: true },
        });
      case SETTINGS_CHANNELS.SET_THEME:
        if (!['light', 'dark', 'system'].includes(String(payload.theme))) {
          return failure('Unknown preview theme.');
        }
        config.appearance.theme = payload.theme as typeof config.appearance.theme;
        return success(undefined);
      case SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS:
        config.appearance.fontSettings = {
          ...config.appearance.fontSettings,
          ...(payload.fontSettings as Partial<typeof config.appearance.fontSettings>),
        };
        return success(undefined);
      case SYSTEM_CHANNELS.GET_FONTS:
        return success({ fonts: ['Inter', 'Georgia', 'system-ui', 'monospace'] });
      case SYSTEM_CHANNELS.GET_MIC_ACCESS_STATUS:
        return success({ status: 'denied' });
      case SYSTEM_CHANNELS.GET_SYSTEM_AUDIO_ACCESS:
        return success({ status: 'unsupported' });
      default:
        return failure(
          `“${channel}” is disabled in this isolated preview. No real action was taken.`,
        );
    }
  };

  window.electron = {
    invoke: <T = unknown>(channel: string, ...args: unknown[]) =>
      invoke(channel, args) as Promise<IpcResponse<T>>,
    on: (channel: string, listener: Listener) => {
      const subscribed = listeners.get(channel) ?? new Set<Listener>();
      subscribed.add(listener);
      listeners.set(channel, subscribed);
      return () => {
        subscribed.delete(listener);
      };
    },
    once: (channel: string, listener: Listener) => {
      const unsubscribe = window.electron.on(channel, (...args: unknown[]) => {
        unsubscribe();
        listener(...args);
      });
    },
    off: (channel: string, listener: Listener) => {
      listeners.get(channel)?.delete(listener);
    },
  };

  return {
    /** Call before resetting renderer stores and remounting the App. */
    async setScenario(next: StressScenario): Promise<void> {
      pending.forEach((resolve) =>
        resolve(failure('Preview scenario changed.', 'STRESS_CANCELLED')),
      );
      pending.clear();
      // Let canceled IPC → validation → store continuations settle first.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      scenario = next;
      fixture = createStressFixture(next);
      contents.clear();
      settings.clear();
      config = previewConfig();
    },
  };
}
