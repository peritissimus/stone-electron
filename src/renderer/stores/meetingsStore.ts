/**
 * meetingsStore — list / get / mutate state for the Meetings management
 * page. Separate from meetingRecorderStore (the active capture session)
 * so the page can render past meetings without subscribing to recorder
 * state changes.
 */

import { create } from 'zustand';
import { meetingAPI } from '@renderer/api';
import { handleIpcResponse } from '@renderer/lib/ipc';
import { logger } from '@renderer/lib/logger';
import type { MeetingRecording } from '@shared/types';

interface MeetingsState {
  recordings: MeetingRecording[];
  loading: boolean;
  loadedOnce: boolean;
  error: string | null;
  selectedId: string | null;
  /** id → in-flight action so the UI can disable buttons individually. */
  busyIds: Set<string>;

  load: () => Promise<void>;
  select: (id: string | null) => void;
  upsertLocal: (recording: MeetingRecording) => void;
  removeLocal: (id: string) => void;
  resummarize: (id: string, promptTemplate?: string) => Promise<void>;
  retranscribe: (id: string) => Promise<void>;
  sendToJournal: (id: string) => Promise<{ journalNoteId: string } | null>;
  remove: (id: string) => Promise<void>;
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  recordings: [],
  loading: false,
  loadedOnce: false,
  error: null,
  selectedId: null,
  busyIds: new Set(),

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const result = handleIpcResponse(await meetingAPI.list(), 'Failed to load meetings');
      if (!result.success) {
        set({ loading: false, loadedOnce: true, error: result.error });
        return;
      }
      set({
        recordings: result.data.recordings,
        loading: false,
        loadedOnce: true,
      });
    } catch (err) {
      logger.error('[meetingsStore] load failed', err);
      set({
        loading: false,
        loadedOnce: true,
        error: err instanceof Error ? err.message : 'Failed to load meetings',
      });
    }
  },

  select: (id) => set({ selectedId: id }),

  upsertLocal: (recording) =>
    set((state) => {
      const idx = state.recordings.findIndex((r) => r.id === recording.id);
      if (idx === -1) return { recordings: [recording, ...state.recordings] };
      const next = [...state.recordings];
      next[idx] = recording;
      return { recordings: next };
    }),

  removeLocal: (id) =>
    set((state) => ({
      recordings: state.recordings.filter((r) => r.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  resummarize: async (id, promptTemplate) => {
    markBusy(set, id, true);
    try {
      const result = handleIpcResponse(
        await meetingAPI.resummarize(id, promptTemplate),
        'Failed to re-summarize',
      );
      if (result.success) {
        get().upsertLocal(result.data.recording);
      } else {
        set({ error: result.error });
      }
    } catch (err) {
      logger.error('[meetingsStore] resummarize failed', err);
      set({ error: err instanceof Error ? err.message : 'Failed to re-summarize' });
    } finally {
      markBusy(set, id, false);
    }
  },

  retranscribe: async (id) => {
    markBusy(set, id, true);
    try {
      const result = handleIpcResponse(
        await meetingAPI.retranscribe(id),
        'Failed to re-transcribe',
      );
      if (result.success) {
        get().upsertLocal(result.data.recording);
      } else {
        set({ error: result.error });
      }
    } catch (err) {
      logger.error('[meetingsStore] retranscribe failed', err);
      set({ error: err instanceof Error ? err.message : 'Failed to re-transcribe' });
    } finally {
      markBusy(set, id, false);
    }
  },

  sendToJournal: async (id) => {
    markBusy(set, id, true);
    try {
      const result = handleIpcResponse(
        await meetingAPI.sendToJournal(id),
        'Failed to send to journal',
      );
      if (result.success) {
        get().upsertLocal(result.data.recording);
        return { journalNoteId: result.data.journalNoteId };
      }
      set({ error: result.error });
      return null;
    } catch (err) {
      logger.error('[meetingsStore] sendToJournal failed', err);
      set({ error: err instanceof Error ? err.message : 'Failed to send to journal' });
      return null;
    } finally {
      markBusy(set, id, false);
    }
  },

  remove: async (id) => {
    markBusy(set, id, true);
    try {
      const response = await meetingAPI.delete(id);
      if (!response.success) {
        set({ error: response.error?.message ?? 'Failed to delete' });
        return;
      }
      get().removeLocal(id);
    } catch (err) {
      logger.error('[meetingsStore] delete failed', err);
      set({ error: err instanceof Error ? err.message : 'Failed to delete' });
    } finally {
      markBusy(set, id, false);
    }
  },
}));

function markBusy(set: (fn: (s: MeetingsState) => Partial<MeetingsState>) => void, id: string, busy: boolean) {
  set((s) => {
    const next = new Set(s.busyIds);
    if (busy) next.add(id);
    else next.delete(id);
    return { busyIds: next };
  });
}

// Live status from the durable background finalize pipeline. The main
// process pushes the recording on each transition ('transcribing' →
// 'summarizing' → 'ready' | 'failed'); reflect it in the list so an open
// Meetings view updates without a manual refresh. Only upserts a recording
// already known to the list (the recorder store owns brand-new sessions and
// splices them in via useMeetings on completion). Subscribed once at init.
meetingAPI.onStatusChanged((recording) => {
  const store = useMeetingsStore.getState();
  if (store.recordings.some((r) => r.id === recording.id)) {
    store.upsertLocal(recording);
  }
});
