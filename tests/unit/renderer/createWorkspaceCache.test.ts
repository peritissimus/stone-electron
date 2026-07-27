/**
 * These races were previously written out once per store and tested in neither.
 * Now that they live in one module, they get pinned here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';
import {
  createWorkspaceCache,
  type WorkspaceCacheState,
} from '@renderer/services/stores/createWorkspaceCache';

const load = vi.fn();

interface ProbeState extends WorkspaceCacheState {
  items: string[];
  ensureLoaded: () => Promise<void>;
  refresh: (showLoading?: boolean) => Promise<void>;
}

function makeStore() {
  const cache = createWorkspaceCache<ProbeState, string[]>({
    label: 'probe',
    load,
    apply: (items) => ({ items }),
    failureMessage: 'Failed to load probe',
  });

  return create<ProbeState>((set, get) => ({
    ...cache.initialState,
    items: [],
    ensureLoaded: () => cache.ensureLoaded(set, get),
    refresh: (showLoading) => cache.refresh(set, get, showLoading),
  }));
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const ok = (items: string[]) => ({ success: true as const, data: items });

describe('createWorkspaceCache', () => {
  beforeEach(() => {
    // Not clearAllMocks: that clears call records but leaves the
    // mockReturnValueOnce queue intact, so a value queued by one test and left
    // unconsumed becomes the first answer the next test receives.
    load.mockReset();
    useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-a' });
  });

  it('collapses a burst of refreshes into one request', async () => {
    const gate = deferred<ReturnType<typeof ok>>();
    load.mockReturnValue(gate.promise);
    const store = makeStore();

    const flights = [store.getState().refresh(), store.getState().refresh(), store.getState().refresh()];
    gate.resolve(ok(['a']));
    await Promise.all(flights);

    expect(load).toHaveBeenCalledOnce();
    expect(store.getState().items).toEqual(['a']);
  });

  it('does not serve one workspace the answer fetched for another', async () => {
    const first = deferred<ReturnType<typeof ok>>();
    load.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok(['from-b']));
    const store = makeStore();

    const stale = store.getState().refresh();
    // The workspace changes while the first request is still in the air.
    useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-b' });
    first.resolve(ok(['from-a']));
    await stale;

    expect(store.getState().items).toEqual([]);
    expect(store.getState().workspaceId).toBeNull();
  });

  it('re-runs rather than joining a flight belonging to another workspace', async () => {
    const first = deferred<ReturnType<typeof ok>>();
    load.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok(['from-b']));
    const store = makeStore();

    void store.getState().refresh();
    useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-b' });
    const second = store.getState().refresh();
    first.resolve(ok(['from-a']));
    await second;

    expect(load).toHaveBeenCalledTimes(2);
    expect(store.getState().items).toEqual(['from-b']);
    expect(store.getState().workspaceId).toBe('workspace-b');
  });

  it('skips the request when the workspace is already cached', async () => {
    load.mockResolvedValue(ok(['a']));
    const store = makeStore();

    await store.getState().ensureLoaded();
    await store.getState().ensureLoaded();

    expect(load).toHaveBeenCalledOnce();
  });

  it('fetches again once the workspace changes', async () => {
    load.mockResolvedValue(ok(['a']));
    const store = makeStore();

    await store.getState().ensureLoaded();
    useWorkspaceStore.setState({ activeWorkspaceId: 'workspace-b' });
    await store.getState().ensureLoaded();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows a spinner on the first load but not on a background refresh', async () => {
    const gate = deferred<ReturnType<typeof ok>>();
    load.mockReturnValue(gate.promise);
    const store = makeStore();

    const first = store.getState().ensureLoaded();
    expect(store.getState().loading).toBe(true);
    gate.resolve(ok(['a']));
    await first;

    const later = deferred<ReturnType<typeof ok>>();
    load.mockReturnValue(later.promise);
    const background = store.getState().refresh();
    expect(store.getState().loading).toBe(false);
    expect(store.getState().refreshing).toBe(true);
    later.resolve(ok(['b']));
    await background;

    expect(store.getState().refreshing).toBe(false);
  });

  it('reports a failed load and stops both progress flags', async () => {
    load.mockResolvedValue({ success: false, error: { message: 'no notes' } });
    const store = makeStore();

    await store.getState().refresh();

    expect(store.getState().error).toBe('no notes');
    expect(store.getState().loading).toBe(false);
    expect(store.getState().refreshing).toBe(false);
    expect(store.getState().loaded).toBe(false);
  });

  it('clears a previous error when a later load succeeds', async () => {
    load.mockResolvedValueOnce({ success: false, error: { message: 'no notes' } });
    const store = makeStore();
    await store.getState().refresh();
    expect(store.getState().error).toBe('no notes');

    load.mockResolvedValueOnce(ok(['a']));
    await store.getState().refresh();

    expect(store.getState().error).toBeNull();
    expect(store.getState().items).toEqual(['a']);
  });
});
