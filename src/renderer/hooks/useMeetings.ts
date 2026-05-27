/**
 * useMeetings — read-side hook for the Meetings page. Loads the list
 * on mount, exposes actions through the store, and slips any freshly
 * finalized recording from the recorder store into the list as it
 * arrives (so the user doesn't have to refresh).
 */

import { useEffect } from 'react';
import { useMeetingsStore } from '@renderer/stores/meetingsStore';
import { useMeetingRecorderStore } from '@renderer/stores/meetingRecorderStore';

export function useMeetings() {
  const recordings = useMeetingsStore((s) => s.recordings);
  const loading = useMeetingsStore((s) => s.loading);
  const loadedOnce = useMeetingsStore((s) => s.loadedOnce);
  const error = useMeetingsStore((s) => s.error);
  const selectedId = useMeetingsStore((s) => s.selectedId);
  const busyIds = useMeetingsStore((s) => s.busyIds);

  const load = useMeetingsStore((s) => s.load);
  const select = useMeetingsStore((s) => s.select);
  const resummarize = useMeetingsStore((s) => s.resummarize);
  const sendToJournal = useMeetingsStore((s) => s.sendToJournal);
  const remove = useMeetingsStore((s) => s.remove);
  const upsertLocal = useMeetingsStore((s) => s.upsertLocal);

  // Initial load.
  useEffect(() => {
    if (!loadedOnce) void load();
  }, [load, loadedOnce]);

  // When the recorder finishes a session, splice the result into the list.
  const lastRecording = useMeetingRecorderStore((s) => s.lastRecording);
  useEffect(() => {
    if (lastRecording) upsertLocal(lastRecording);
  }, [lastRecording, upsertLocal]);

  const selected = recordings.find((r) => r.id === selectedId) ?? null;

  return {
    recordings,
    loading,
    loadedOnce,
    error,
    selected,
    select,
    resummarize,
    sendToJournal,
    remove,
    isBusy: (id: string) => busyIds.has(id),
    reload: load,
  };
}
