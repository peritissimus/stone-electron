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
  NOTEBOOK_CHANNELS,
  PERFORMANCE_CHANNELS,
  QUICK_CAPTURE_CHANNELS,
  QUICK_NOTE_CHANNELS,
  SCRATCH_CHANNELS,
  SEARCH_CHANNELS,
  SETTINGS_CHANNELS,
  STATUS_REPORT_CHANNELS,
  SYSTEM_CHANNELS,
  TAG_CHANNELS,
  TEMPLATE_CHANNELS,
  TOPIC_CHANNELS,
  WORKSPACE_CHANNELS,
} from '@shared/constants/ipcChannels';
import type { IpcResponse, Note, Workspace } from '@shared/types';
import { apiFetch, apiFetchBytes } from '@renderer/api/httpClient';
import * as browserEventStream from './browserEventStream';
import * as browserExport from './browserExport';
import * as browserScratch from './browserScratch';
import * as browserSystem from './browserSystem';

type RequestPayload = Record<string, unknown>;

interface NotesResponse {
  notes: Note[];
  total: number;
}

interface NoteResponse {
  note: Note;
  content?: string;
}

interface TreeNode {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

const success = <T>(data: T): IpcResponse<T> => ({
  success: true,
  data,
});

const failure = (channel: string, error: unknown): IpcResponse<never> => ({
  success: false,
  error: {
    code: 'WEB_TRANSPORT_ERROR',
    message:
      error instanceof Error ? error.message : `The web transport does not support ${channel} yet`,
  },
});

const request = (args: unknown[]): RequestPayload => (args[0] as RequestPayload | undefined) ?? {};

/** Journal dates are calendar-local everywhere else in the app, never UTC. */
const localCalendarDate = (): string => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
};

/** Desktop-only integrations, reported per source so the daily review can settle. */
const UNAVAILABLE_INTEGRATIONS: Record<
  string,
  { source: string; status: 'unavailable'; message: string; data: unknown }
> = {
  calendar: {
    source: 'calendar',
    status: 'unavailable',
    message: 'Calendar integration is available in the desktop app.',
    data: { events: [] },
  },
  mail: {
    source: 'mail',
    status: 'unavailable',
    message: 'Mail integration is available in the desktop app.',
    data: { unreadCount: 0, messages: [] },
  },
  linear: {
    source: 'linear',
    status: 'unavailable',
    message: 'Linear is not configured for the web server.',
    data: { issues: [] },
  },
};

const PREVIEW_CHARS = 280;

/** Mirrors trimPreview in the daily-review use cases so both transports read alike. */
const trimPreview = (content: string): string | null => {
  const stripped = content
    .replaceAll(/^#{1,6}\s+.*$/gm, '')
    .replaceAll(/^\s+|\s+$/g, '')
    .replaceAll(/\n{3,}/g, '\n\n');
  if (!stripped) return null;
  if (stripped.length <= PREVIEW_CHARS) return stripped;
  return `${stripped.slice(0, PREVIEW_CHARS).trim()}…`;
};

interface JournalEntry {
  date: string;
  noteId: string | null;
  exists: boolean;
  content: string | null;
}

const fetchTodayJournal = async (date: string) => {
  const empty = { date, exists: false, noteId: null, contentPreview: null };
  try {
    const { entries } = await apiFetch<{ entries: JournalEntry[] }>('/api/journals?limit=1');
    const entry = entries.find((candidate) => candidate.date === date) ?? entries[0];
    if (!entry) return empty;
    return {
      date: entry.date,
      exists: entry.exists,
      noteId: entry.noteId,
      contentPreview: entry.content ? trimPreview(entry.content) : null,
    };
  } catch {
    return empty;
  }
};

const fetchNotes = (payload: RequestPayload = {}): Promise<NotesResponse> => {
  const query = new URLSearchParams();
  if (payload.notebookId) query.set('notebookId', String(payload.notebookId));
  if (payload.isFavorite) query.set('filter', 'favorites');
  else if (payload.isPinned) query.set('filter', 'pinned');
  else if (payload.isArchived) query.set('filter', 'archived');
  const suffix = query.size ? `?${query.toString()}` : '';
  return apiFetch<NotesResponse>(`/api/notes${suffix}`);
};

function buildWorkspaceTree(notes: Note[]): TreeNode[] {
  const roots: TreeNode[] = [];

  for (const note of notes) {
    if (!note.filePath) continue;
    const parts = note.filePath.split('/').filter(Boolean);
    let level = roots;
    let prefix = '';

    for (const [index, part] of parts.entries()) {
      prefix = prefix ? `${prefix}/${part}` : part;
      const isFile = index === parts.length - 1;
      let node = level.find((candidate) => candidate.name === part);
      if (!node) {
        node = {
          name: part,
          path: prefix,
          relativePath: prefix,
          type: isFile ? 'file' : 'folder',
          ...(isFile ? {} : { children: [] }),
        };
        level.push(node);
      }
      if (!isFile) {
        node.children ??= [];
        level = node.children;
      }
    }
  }

  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((node) => ({
        ...node,
        ...(node.children ? { children: sort(node.children) } : {}),
      }))
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'folder' ? -1 : 1;
        return left.name.localeCompare(right.name);
      });

  return sort(roots);
}

async function invokeWebChannel<T>(channel: string, args: unknown[]): Promise<IpcResponse<T>> {
  const payload = request(args);

  try {
    switch (channel) {
      case NOTE_CHANNELS.GET_ALL:
        return success(await fetchNotes(payload)) as IpcResponse<T>;
      case NOTE_CHANNELS.GET: {
        const result = await apiFetch<NoteResponse>(
          `/api/notes/${encodeURIComponent(String(payload.id))}`,
        );
        return success(result.note) as IpcResponse<T>;
      }
      case NOTE_CHANNELS.GET_CONTENT:
        return success(
          await apiFetch<{ content: string }>(
            `/api/notes/${encodeURIComponent(String(payload.id))}/content`,
          ),
        ) as IpcResponse<T>;
      case NOTE_CHANNELS.GET_BY_PATH: {
        const result = await fetchNotes();
        const filePath = String(payload.filePath ?? payload.path ?? '');
        const match = result.notes.find((note) => note.filePath === filePath);
        if (!match) throw new Error(`Note not found for path: ${filePath}`);
        return success(match) as IpcResponse<T>;
      }
      case NOTE_CHANNELS.CREATE: {
        const note = await apiFetch<Note>('/api/notes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (typeof payload.content === 'string') {
          await apiFetch(`/api/notes/${encodeURIComponent(note.id)}/links`, {
            method: 'PUT',
            body: JSON.stringify({ content: payload.content }),
          });
        }
        return success(note) as IpcResponse<T>;
      }
      case NOTE_CHANNELS.UPDATE: {
        const note = await apiFetch<Note>(`/api/notes/${encodeURIComponent(String(payload.id))}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (typeof payload.content === 'string') {
          await apiFetch(`/api/notes/${encodeURIComponent(String(payload.id))}/links`, {
            method: 'PUT',
            body: JSON.stringify({ content: payload.content }),
          });
        }
        return success(note) as IpcResponse<T>;
      }
      case NOTE_CHANNELS.DELETE:
        await apiFetch<void>(`/api/notes/${encodeURIComponent(String(payload.id))}`, {
          method: 'DELETE',
        });
        return success(undefined) as IpcResponse<T>;
      case NOTE_CHANNELS.FAVORITE:
      case NOTE_CHANNELS.PIN:
      case NOTE_CHANNELS.ARCHIVE: {
        const action =
          channel === NOTE_CHANNELS.FAVORITE
            ? 'favorite'
            : channel === NOTE_CHANNELS.PIN
              ? 'pin'
              : 'archive';
        return success(
          await apiFetch<Note>(`/api/notes/${encodeURIComponent(String(payload.id))}/${action}`, {
            method: 'POST',
          }),
        ) as IpcResponse<T>;
      }
      case NOTE_CHANNELS.MOVE:
        return success(
          await apiFetch<Note>(`/api/notes/${encodeURIComponent(String(payload.id))}/move`, {
            method: 'POST',
            body: JSON.stringify({
              targetNotebookId: payload.targetNotebookId ?? payload.targetPath ?? null,
            }),
          }),
        ) as IpcResponse<T>;
      case NOTE_CHANNELS.GET_ALL_TODOS:
        return success(await apiFetch('/api/tasks')) as IpcResponse<T>;
      case NOTE_CHANNELS.UPDATE_TASK_STATE:
        await apiFetch(
          `/api/notes/${encodeURIComponent(String(payload.noteId))}/tasks/${encodeURIComponent(String(payload.taskIndex))}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ newState: payload.newState }),
          },
        );
        return success(undefined) as IpcResponse<T>;
      case NOTE_CHANNELS.GET_VERSIONS:
        return success(
          await apiFetch(
            `/api/notes/${encodeURIComponent(String(payload.id ?? payload.noteId))}/versions`,
          ),
        ) as IpcResponse<T>;
      case NOTE_CHANNELS.RESTORE_VERSION:
        return success(
          await apiFetch(
            `/api/notes/${encodeURIComponent(String(payload.id))}/versions/${encodeURIComponent(String(payload.versionId))}/restore`,
            { method: 'POST' },
          ),
        ) as IpcResponse<T>;
      case NOTE_CHANNELS.GET_BACKLINKS:
        return success(
          await apiFetch(`/api/notes/${encodeURIComponent(String(payload.id))}/backlinks`),
        ) as IpcResponse<T>;
      case NOTE_CHANNELS.GET_FORWARD_LINKS:
        return success(
          await apiFetch(`/api/notes/${encodeURIComponent(String(payload.id))}/forward-links`),
        ) as IpcResponse<T>;
      case NOTE_CHANNELS.GET_GRAPH_DATA: {
        const query = new URLSearchParams();
        if (payload.centerNoteId) {
          query.set('centerNoteId', String(payload.centerNoteId));
        }
        if (payload.depth !== undefined) query.set('depth', String(payload.depth));
        query.set('includeOrphans', String(payload.includeOrphans !== false));
        return success(await apiFetch(`/api/graph?${query.toString()}`)) as IpcResponse<T>;
      }
      case QUICK_NOTE_CHANNELS.CREATE_IN_SLOT:
        return success(
          await apiFetch('/api/quick-notes', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;

      case WORKSPACE_CHANNELS.GET_ALL:
        return success({
          workspaces: [await apiFetch<Workspace>('/api/workspace')],
        }) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.GET_ACTIVE:
        return success({
          workspace: await apiFetch<Workspace>('/api/workspace'),
        }) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.SET_ACTIVE:
      case WORKSPACE_CHANNELS.CREATE:
      case WORKSPACE_CHANNELS.UPDATE:
        return success(await apiFetch<Workspace>('/api/workspace')) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.DELETE:
        return success(undefined) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.GET_DEFAULT_PATH: {
        const activeWorkspace = await apiFetch<Workspace>('/api/workspace');
        return success({ path: activeWorkspace.folderPath }) as IpcResponse<T>;
      }
      case WORKSPACE_CHANNELS.SELECT_FOLDER:
        return success(
          await apiFetch('/api/workspace/actions/select-folder', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.VALIDATE_PATH:
        return success(
          await apiFetch('/api/workspace/actions/validate-path', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.SCAN: {
        const result = await fetchNotes();
        return success({
          structure: buildWorkspaceTree(result.notes),
          counts: {},
          files: result.notes
            .filter((note) => note.filePath)
            .map((note) => ({
              path: note.filePath,
              relativePath: note.filePath,
            })),
          total: result.notes.length,
        }) as IpcResponse<T>;
      }
      case WORKSPACE_CHANNELS.SYNC: {
        const activeWorkspace = await apiFetch<Workspace>('/api/workspace');
        return success({
          workspaceId: activeWorkspace.id,
          notebooks: { created: 0, updated: 0, errors: [] },
          notes: {
            created: 0,
            updated: 0,
            deleted: 0,
            embedded: 0,
            errors: [],
          },
        }) as IpcResponse<T>;
      }

      case NOTEBOOK_CHANNELS.GET_ALL:
        return success(
          await apiFetch<{ notebooks: unknown[] }>('/api/notebooks'),
        ) as IpcResponse<T>;
      case NOTEBOOK_CHANNELS.CREATE:
        return success(
          await apiFetch('/api/notebooks', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case NOTEBOOK_CHANNELS.UPDATE:
        return success(
          await apiFetch(`/api/notebooks/${encodeURIComponent(String(payload.id))}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case NOTEBOOK_CHANNELS.MOVE:
        await apiFetch(`/api/notebooks/${encodeURIComponent(String(payload.id))}/move`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return success(undefined) as IpcResponse<T>;
      case NOTEBOOK_CHANNELS.DELETE:
        await apiFetch(
          `/api/notebooks/${encodeURIComponent(String(payload.id))}?deleteNotes=${payload.delete_notes === true}`,
          { method: 'DELETE' },
        );
        return success(undefined) as IpcResponse<T>;

      case TAG_CHANNELS.GET_ALL:
        return success(await apiFetch<{ tags: unknown[] }>('/api/tags')) as IpcResponse<T>;
      case TAG_CHANNELS.CREATE:
        return success(
          await apiFetch('/api/tags', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case TAG_CHANNELS.DELETE:
        await apiFetch(`/api/tags/${encodeURIComponent(String(payload.id))}`, {
          method: 'DELETE',
        });
        return success(undefined) as IpcResponse<T>;
      case TAG_CHANNELS.ADD_TO_NOTE:
        return success(
          await apiFetch(`/api/notes/${encodeURIComponent(String(payload.noteId))}/tags`, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case TAG_CHANNELS.REMOVE_FROM_NOTE:
        await apiFetch(
          `/api/notes/${encodeURIComponent(String(payload.noteId))}/tags/${encodeURIComponent(String(payload.tagId))}`,
          { method: 'DELETE' },
        );
        return success(undefined) as IpcResponse<T>;

      case ATTACHMENT_CHANNELS.GET_ALL:
        return success(
          await apiFetch(`/api/notes/${encodeURIComponent(String(payload.noteId))}/attachments`),
        ) as IpcResponse<T>;
      case ATTACHMENT_CHANNELS.UPLOAD_IMAGE:
        return success(
          await apiFetch(
            `/api/notes/${encodeURIComponent(String(payload.noteId))}/attachments/images`,
            {
              method: 'POST',
              body: JSON.stringify(payload),
            },
          ),
        ) as IpcResponse<T>;
      case ATTACHMENT_CHANNELS.DELETE:
        await apiFetch(`/api/attachments/${encodeURIComponent(String(payload.id))}`, {
          method: 'DELETE',
        });
        return success(undefined) as IpcResponse<T>;
      case ATTACHMENT_CHANNELS.ADD:
        throw new Error(
          'Use image upload in the browser; desktop file paths are not available to web pages.',
        );

      case SEARCH_CHANNELS.FULL_TEXT:
      case SEARCH_CHANNELS.HYBRID:
      case SEARCH_CHANNELS.SEMANTIC: {
        const query = new URLSearchParams({
          query: String(payload.query ?? ''),
          limit: String(payload.limit ?? 20),
        });
        return success(await apiFetch(`/api/search?${query.toString()}`)) as IpcResponse<T>;
      }
      case SEARCH_CHANNELS.BY_DATE_RANGE:
      case SEARCH_CHANNELS.BY_TAG:
      case SEARCH_CHANNELS.GET_RELATED:
        return success({ results: [] }) as IpcResponse<T>;

      case SETTINGS_CHANNELS.GET:
        return success(
          await apiFetch(`/api/settings?key=${encodeURIComponent(String(payload.key))}`),
        ) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_ALL:
        return success(await apiFetch('/api/settings')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_APPEARANCE:
        return success(await apiFetch('/api/settings/appearance')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_EDITOR:
        return success(await apiFetch('/api/settings/editor')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_SHORTCUTS:
        return success(await apiFetch('/api/settings/shortcuts')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_ONBOARDING:
        return success(await apiFetch('/api/settings/onboarding')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_AI:
        return success(await apiFetch('/api/settings/ai')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_AI_PROVIDER_KEYS:
        return success(await apiFetch('/api/settings/ai-provider-keys')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_MEETINGS:
        return success(await apiFetch('/api/settings/meetings')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_INTEGRATIONS:
        return success(await apiFetch('/api/settings/integrations')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.GET_QUICK_CAPTURE_SHORTCUT:
        return success(await apiFetch('/api/settings/quick-capture-shortcut')) as IpcResponse<T>;
      case SETTINGS_CHANNELS.SET:
      case SETTINGS_CHANNELS.SET_THEME:
      case SETTINGS_CHANNELS.SET_ACCENT_COLOR:
      case SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS:
      case SETTINGS_CHANNELS.RESET_FONT_SETTINGS:
      case SETTINGS_CHANNELS.UPDATE_EDITOR:
      case SETTINGS_CHANNELS.RESET_EDITOR:
      case SETTINGS_CHANNELS.SET_SHORTCUT:
      case SETTINGS_CHANNELS.RESET_SHORTCUT:
      case SETTINGS_CHANNELS.RESET_ALL_SHORTCUTS:
      case SETTINGS_CHANNELS.UPDATE_AI:
      case SETTINGS_CHANNELS.RESET_AI:
      case SETTINGS_CHANNELS.SET_AI_PROVIDER_KEY:
      case SETTINGS_CHANNELS.DELETE_AI_PROVIDER_KEY:
      case SETTINGS_CHANNELS.UPDATE_MEETINGS:
      case SETTINGS_CHANNELS.RESET_MEETINGS:
      case SETTINGS_CHANNELS.UPDATE_INTEGRATIONS:
      case SETTINGS_CHANNELS.UPDATE_ONBOARDING:
      case SETTINGS_CHANNELS.RESET_ONBOARDING:
      case SETTINGS_CHANNELS.SET_QUICK_CAPTURE_SHORTCUT: {
        const actions: Record<string, string> = {
          [SETTINGS_CHANNELS.SET]: 'set',
          [SETTINGS_CHANNELS.SET_THEME]: 'set-theme',
          [SETTINGS_CHANNELS.SET_ACCENT_COLOR]: 'set-accent-color',
          [SETTINGS_CHANNELS.UPDATE_FONT_SETTINGS]: 'update-font-settings',
          [SETTINGS_CHANNELS.RESET_FONT_SETTINGS]: 'reset-font-settings',
          [SETTINGS_CHANNELS.UPDATE_EDITOR]: 'update-editor',
          [SETTINGS_CHANNELS.RESET_EDITOR]: 'reset-editor',
          [SETTINGS_CHANNELS.SET_SHORTCUT]: 'set-shortcut',
          [SETTINGS_CHANNELS.RESET_SHORTCUT]: 'reset-shortcut',
          [SETTINGS_CHANNELS.RESET_ALL_SHORTCUTS]: 'reset-all-shortcuts',
          [SETTINGS_CHANNELS.UPDATE_AI]: 'update-ai',
          [SETTINGS_CHANNELS.RESET_AI]: 'reset-ai',
          [SETTINGS_CHANNELS.SET_AI_PROVIDER_KEY]: 'set-ai-provider-key',
          [SETTINGS_CHANNELS.DELETE_AI_PROVIDER_KEY]: 'delete-ai-provider-key',
          [SETTINGS_CHANNELS.UPDATE_MEETINGS]: 'update-meetings',
          [SETTINGS_CHANNELS.RESET_MEETINGS]: 'reset-meetings',
          [SETTINGS_CHANNELS.UPDATE_INTEGRATIONS]: 'update-integrations',
          [SETTINGS_CHANNELS.UPDATE_ONBOARDING]: 'update-onboarding',
          [SETTINGS_CHANNELS.RESET_ONBOARDING]: 'reset-onboarding',
          [SETTINGS_CHANNELS.SET_QUICK_CAPTURE_SHORTCUT]: 'set-quick-capture-shortcut',
        };
        return success(
          await apiFetch(`/api/settings/actions/${actions[channel]}`, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      }

      case DAILY_REVIEW_CHANNELS.GET: {
        const date = localCalendarDate();
        const [result, todayJournal] = await Promise.all([fetchNotes(), fetchTodayJournal(date)]);
        return success({
          date,
          todayJournal,
          todayMeetings: [],
          openTasks: [],
          recentNotes: result.notes.slice(0, 8),
          onThisDay: [],
        }) as IpcResponse<T>;
      }
      case JOURNAL_CHANNELS.OPEN_OR_CREATE_FOR_DATE:
        return success(
          await apiFetch('/api/journals', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case JOURNAL_CHANNELS.LIST_RANGE: {
        const query = new URLSearchParams({
          limit: String(payload.limit ?? 14),
        });
        if (payload.workspaceId) {
          query.set('workspaceId', String(payload.workspaceId));
        }
        return success(await apiFetch(`/api/journals?${query.toString()}`)) as IpcResponse<T>;
      }
      case DAILY_REVIEW_CHANNELS.LIST_CALENDARS:
        return success({
          status: 'unavailable',
          calendars: [],
          message: 'Calendar integration is available in the desktop app.',
        }) as IpcResponse<T>;
      case DAILY_REVIEW_CHANNELS.LOAD_INTEGRATIONS:
        // Every source must report back; an empty list leaves the UI spinning.
        return success(Object.values(UNAVAILABLE_INTEGRATIONS)) as IpcResponse<T>;
      case DAILY_REVIEW_CHANNELS.LOAD_INTEGRATION: {
        const source = String(payload.source);
        return success(
          UNAVAILABLE_INTEGRATIONS[source] ?? UNAVAILABLE_INTEGRATIONS.linear,
        ) as IpcResponse<T>;
      }
      case MEETING_CHANNELS.LIST: {
        const query = new URLSearchParams();
        if (payload.limit) query.set('limit', String(payload.limit));
        if (payload.cursor !== undefined && payload.cursor !== null) {
          query.set('cursor', String(payload.cursor));
        }
        const suffix = query.size ? `?${query.toString()}` : '';
        return success(await apiFetch(`/api/meetings${suffix}`)) as IpcResponse<T>;
      }
      case MEETING_CHANNELS.GET:
        return success(
          await apiFetch(`/api/meetings/${encodeURIComponent(String(payload.recordingId))}`),
        ) as IpcResponse<T>;
      case MEETING_CHANNELS.DELETE:
        return success(
          await apiFetch(`/api/meetings/${encodeURIComponent(String(payload.recordingId))}`, {
            method: 'DELETE',
          }),
        ) as IpcResponse<T>;
      case MEETING_CHANNELS.RESERVE_SLOT:
        return success(
          await apiFetch('/api/meetings', { method: 'POST', body: JSON.stringify(payload) }),
        ) as IpcResponse<T>;
      case MEETING_CHANNELS.APPEND_AUDIO: {
        const chunk = payload.chunk as ArrayBuffer | undefined;
        if (!chunk) throw new Error('No audio was captured.');
        const channel_ = payload.channel === 'system' ? 'system' : 'mic';
        await apiFetch(
          `/api/meetings/${encodeURIComponent(String(payload.recordingId))}/audio/${channel_}`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/octet-stream' },
            body: chunk,
          },
        );
        return success(undefined) as IpcResponse<T>;
      }
      case MEETING_CHANNELS.GET_AUDIO: {
        const id = encodeURIComponent(String(payload.recordingId));
        // Tracks are fetched separately so a missing system track is just null.
        const [mic, system] = await Promise.all([
          apiFetchBytes(`/api/meetings/${id}/audio/mic`),
          apiFetchBytes(`/api/meetings/${id}/audio/system`),
        ]);
        return success({ mic, system }) as IpcResponse<T>;
      }
      case MEETING_CHANNELS.FINALIZE:
        return success(
          await apiFetch(
            `/api/meetings/${encodeURIComponent(String(payload.recordingId))}/actions/finalize`,
            { method: 'POST', body: JSON.stringify({ durationMs: payload.durationMs ?? 0 }) },
          ),
        ) as IpcResponse<T>;
      case MEETING_CHANNELS.RESUMMARIZE:
      case MEETING_CHANNELS.RETRANSCRIBE:
      case MEETING_CHANNELS.SEND_TO_JOURNAL: {
        const actions: Record<string, string> = {
          [MEETING_CHANNELS.RESUMMARIZE]: 'resummarize',
          [MEETING_CHANNELS.RETRANSCRIBE]: 'retranscribe',
          [MEETING_CHANNELS.SEND_TO_JOURNAL]: 'send-to-journal',
        };
        return success(
          await apiFetch(
            `/api/meetings/${encodeURIComponent(String(payload.recordingId))}/actions/${actions[channel]}`,
            { method: 'POST', body: JSON.stringify(payload) },
          ),
        ) as IpcResponse<T>;
      }
      case MEETING_CHANNELS.WARM_TRANSCRIBER:
        return success(
          await apiFetch('/api/meetings/actions/warm-transcriber', { method: 'POST' }),
        ) as IpcResponse<T>;
      case MEETING_CHANNELS.LIVE_START:
        return success(
          await apiFetch('/api/meetings/live/start', { method: 'POST' }),
        ) as IpcResponse<T>;
      case MEETING_CHANNELS.LIVE_STOP:
        return success(
          await apiFetch('/api/meetings/live/stop', { method: 'POST' }),
        ) as IpcResponse<T>;
      case MEETING_CHANNELS.LIVE_CHUNK: {
        const wav = payload.wav as ArrayBuffer | undefined;
        if (!wav) throw new Error('No audio was captured.');
        return success(
          await apiFetch('/api/meetings/live/chunk', {
            method: 'POST',
            headers: { 'content-type': 'application/octet-stream' },
            body: wav,
          }),
        ) as IpcResponse<T>;
      }
      // Tray state and window focus have no browser equivalent; the recorder
      // calls these on every phase change, so they must succeed quietly.
      case MEETING_CHANNELS.TRAY_SET_STATE:
      case MEETING_CHANNELS.REQUEST_RECORDING:
        return success(undefined) as IpcResponse<T>;
      case PERFORMANCE_CHANNELS.GET_SNAPSHOT:
      case PERFORMANCE_CHANNELS.GET_MEMORY:
      case PERFORMANCE_CHANNELS.GET_CPU:
      case PERFORMANCE_CHANNELS.GET_IPC_STATS:
      case PERFORMANCE_CHANNELS.GET_DB_STATS:
      case PERFORMANCE_CHANNELS.GET_STARTUP: {
        const metrics: Record<string, string> = {
          [PERFORMANCE_CHANNELS.GET_SNAPSHOT]: 'snapshot',
          [PERFORMANCE_CHANNELS.GET_MEMORY]: 'memory',
          [PERFORMANCE_CHANNELS.GET_CPU]: 'cpu',
          [PERFORMANCE_CHANNELS.GET_IPC_STATS]: 'ipc',
          [PERFORMANCE_CHANNELS.GET_DB_STATS]: 'database',
          [PERFORMANCE_CHANNELS.GET_STARTUP]: 'startup',
        };
        // These channels take a bare number rather than an object payload.
        const sinceMs = typeof args[0] === 'number' ? args[0] : undefined;
        const query = sinceMs === undefined ? '' : `?sinceMs=${sinceMs}`;
        return success(
          await apiFetch(`/api/performance/${metrics[channel]}${query}`),
        ) as IpcResponse<T>;
      }
      case PERFORMANCE_CHANNELS.CLEAR_HISTORY:
        return success(
          await apiFetch('/api/performance/actions/clear-history', { method: 'POST' }),
        ) as IpcResponse<T>;
      case DAILY_REVIEW_CHANNELS.SUMMARIZE:
        return success(
          await apiFetch('/api/daily-review/actions/summarize', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case QUICK_CAPTURE_CHANNELS.APPEND_TO_JOURNAL:
        return success(
          await apiFetch('/api/quick-capture/journal', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case QUICK_CAPTURE_CHANNELS.TRANSCRIBE_VOICE: {
        const wav = payload.wav as ArrayBuffer | Uint8Array | undefined;
        if (!wav) throw new Error('No audio was captured.');
        return success(
          await apiFetch('/api/quick-capture/voice', {
            method: 'POST',
            headers: { 'content-type': 'application/octet-stream' },
            body: wav instanceof Uint8Array ? wav.slice().buffer : wav,
          }),
        ) as IpcResponse<T>;
      }
      case WORKSPACE_CHANNELS.CREATE_FOLDER:
        return success(
          await apiFetch('/api/workspace/folders', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.RENAME_FOLDER:
        return success(
          await apiFetch('/api/workspace/folders', {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.MOVE_FOLDER:
        return success(
          await apiFetch('/api/workspace/folders/actions/move', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case WORKSPACE_CHANNELS.DELETE_FOLDER:
        return success(
          await apiFetch(
            `/api/workspace/folders?path=${encodeURIComponent(String(payload.path))}`,
            { method: 'DELETE' },
          ),
        ) as IpcResponse<T>;
      case TOPIC_CHANNELS.GET_EMBEDDING_STATUS:
        return success(await apiFetch('/api/topics/embedding-status')) as IpcResponse<T>;
      case TOPIC_CHANNELS.INITIALIZE:
        return success(
          await apiFetch('/api/topics/actions/initialize', { method: 'POST' }),
        ) as IpcResponse<T>;
      case TOPIC_CHANNELS.SEMANTIC_SEARCH:
        return success(
          await apiFetch('/api/topics/actions/semantic-search', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case INDEX_CHANNELS.GET_STATS:
        return success(await apiFetch('/api/index/stats')) as IpcResponse<T>;
      case INDEX_CHANNELS.INDEX_NOTE:
        return success(
          await apiFetch('/api/index/actions/index-note', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case INDEX_CHANNELS.REBUILD_ALL:
        return success(
          await apiFetch('/api/index/actions/rebuild', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case AI_CHANNELS.ASK_NOTES:
        return success(
          await apiFetch('/api/ai/actions/ask-notes', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case AI_CHANNELS.SUMMARIZE_NOTE:
        return success(
          await apiFetch(`/api/notes/${encodeURIComponent(String(payload.noteId))}/ai/summarize`, {
            method: 'POST',
          }),
        ) as IpcResponse<T>;
      case AI_CHANNELS.SUGGEST_LINKS:
        return success(
          await apiFetch(
            `/api/notes/${encodeURIComponent(String(payload.noteId))}/ai/suggest-links`,
            { method: 'POST', body: JSON.stringify(payload) },
          ),
        ) as IpcResponse<T>;
      case GIT_CHANNELS.GET_STATUS:
        return success(await apiFetch('/api/git/status')) as IpcResponse<T>;
      case GIT_CHANNELS.GET_COMMITS: {
        const query = payload.limit ? `?limit=${encodeURIComponent(String(payload.limit))}` : '';
        return success(await apiFetch(`/api/git/commits${query}`)) as IpcResponse<T>;
      }
      case GIT_CHANNELS.INIT:
      case GIT_CHANNELS.COMMIT:
      case GIT_CHANNELS.PULL:
      case GIT_CHANNELS.PUSH:
      case GIT_CHANNELS.SYNC:
      case GIT_CHANNELS.SET_REMOTE: {
        const actions: Record<string, string> = {
          [GIT_CHANNELS.INIT]: 'init',
          [GIT_CHANNELS.COMMIT]: 'commit',
          [GIT_CHANNELS.PULL]: 'pull',
          [GIT_CHANNELS.PUSH]: 'push',
          [GIT_CHANNELS.SYNC]: 'sync',
          [GIT_CHANNELS.SET_REMOTE]: 'set-remote',
        };
        return success(
          await apiFetch(`/api/git/actions/${actions[channel]}`, {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      }
      case DATABASE_CHANNELS.GET_STATUS:
        return success(await apiFetch('/api/database/status')) as IpcResponse<T>;
      case DATABASE_CHANNELS.VACUUM:
        return success(
          await apiFetch('/api/database/actions/vacuum', { method: 'POST' }),
        ) as IpcResponse<T>;
      case DATABASE_CHANNELS.CHECK_INTEGRITY:
        return success(
          await apiFetch('/api/database/actions/check-integrity', { method: 'POST' }),
        ) as IpcResponse<T>;
      case TEMPLATE_CHANNELS.LIST:
        return success(await apiFetch('/api/templates')) as IpcResponse<T>;
      case TEMPLATE_CHANNELS.CREATE_NOTE_FROM_TEMPLATE:
        return success(
          await apiFetch('/api/templates/actions/create-note', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case STATUS_REPORT_CHANNELS.GENERATE:
        return success(
          await apiFetch('/api/status-report', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ) as IpcResponse<T>;
      case NOTE_CHANNELS.EXPORT_HTML:
      case NOTE_CHANNELS.EXPORT_PDF:
      case NOTE_CHANNELS.EXPORT_MARKDOWN: {
        const format =
          channel === NOTE_CHANNELS.EXPORT_MARKDOWN
            ? 'markdown'
            : channel === NOTE_CHANNELS.EXPORT_PDF
              ? 'pdf'
              : 'html';
        const title = String(payload.title ?? 'note');
        const result = await apiFetch<{ html?: string; markdown?: string }>(
          `/api/notes/${encodeURIComponent(String(payload.id))}/export/${format}`,
          { method: 'POST', body: JSON.stringify(payload) },
        );
        // The server renders; the browser is what actually delivers the file.
        if (format === 'markdown') {
          browserExport.downloadMarkdown(result.markdown ?? '', title);
          return success({ markdown: result.markdown ?? '', path: '' }) as IpcResponse<T>;
        }
        if (format === 'pdf') {
          browserExport.printAsPdf(result.html ?? '');
          return success({ path: '' }) as IpcResponse<T>;
        }
        browserExport.downloadHtml(result.html ?? '', title);
        return success({ html: result.html ?? '', path: '' }) as IpcResponse<T>;
      }
      case SCRATCH_CHANNELS.PICK:
        return success(await browserScratch.pick()) as IpcResponse<T>;
      case SCRATCH_CHANNELS.READ:
        return success(await browserScratch.read(String(payload.path))) as IpcResponse<T>;
      case SCRATCH_CHANNELS.WRITE:
        return success(
          await browserScratch.write(String(payload.path), String(payload.content)),
        ) as IpcResponse<T>;
      case SYSTEM_CHANNELS.GET_FONTS:
        return success(await browserSystem.getFonts()) as IpcResponse<T>;
      case SYSTEM_CHANNELS.GET_MIC_ACCESS_STATUS:
        return success(await browserSystem.getMicAccessStatus()) as IpcResponse<T>;
      case SYSTEM_CHANNELS.REQUEST_MIC_ACCESS:
        return success(await browserSystem.requestMicAccess()) as IpcResponse<T>;
      case SYSTEM_CHANNELS.GET_SYSTEM_AUDIO_ACCESS:
      case SYSTEM_CHANNELS.REQUEST_SYSTEM_AUDIO_ACCESS:
        return success(browserSystem.getSystemAudioAccess()) as IpcResponse<T>;
      case SYSTEM_CHANNELS.OPEN_EXTERNAL:
        browserSystem.openExternal(String(payload.url));
        return success(undefined) as IpcResponse<T>;
      default:
        return failure(channel, undefined) as IpcResponse<T>;
    }
  } catch (error) {
    return failure(channel, error) as IpcResponse<T>;
  }
}

export function installWebElectronBridge(): void {
  window.electron = {
    invoke: <T = unknown>(channel: string, ...args: unknown[]) =>
      invokeWebChannel<T>(channel, args),
    on: (channel: string, listener: (payload: never) => void) =>
      browserEventStream.subscribe(channel, listener as (payload: unknown) => void),
    once: (channel: string, listener: (payload: never) => void) =>
      browserEventStream.subscribeOnce(channel, listener as (payload: unknown) => void),
    off: (channel: string, listener: (payload: never) => void) =>
      browserEventStream.unsubscribe(channel, listener as (payload: unknown) => void),
  };
}
