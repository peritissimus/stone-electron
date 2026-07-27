import type { IpcResponse } from '@shared/types';
import { useWorkspaceStore } from '@renderer/services/workspace/model/workspaceStore';
import { logger } from '@renderer/services/telemetry/logger';

/**
 * Shared `ensureLoaded` / `refresh` template for state cached per workspace.
 *
 * Every store that caches a workspace-scoped collection needs the same four
 * things, and each one that hand-rolled them got the same four subtleties
 * right or wrong independently: a single flight so a burst of events causes one
 * request; a re-run when that flight belonged to a different workspace; a
 * discarded response when the workspace changed mid-request; and the
 * distinction between a first load, which shows a spinner, and a background
 * refresh, which must not.
 *
 * Keeping them here means a race is fixed once rather than per store, and the
 * caller is left saying only what it fetches and where to put it.
 */

type SetState<S> = (update: Partial<S> | ((state: S) => Partial<S>)) => void;
type GetState<S> = () => S;

/** The fields the template owns. A store's own state extends this. */
export interface WorkspaceCacheState {
  workspaceId: string | null;
  loaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export interface WorkspaceCacheConfig<S extends WorkspaceCacheState, T> {
  /** Names the store in logs. */
  label: string;
  load: () => Promise<IpcResponse<T>>;
  /** Maps a successful response onto the store's own fields. */
  apply: (data: T) => Partial<S>;
  failureMessage: string;
}

export interface WorkspaceCache<S extends WorkspaceCacheState> {
  /** Fetches only when nothing is cached for the active workspace. */
  ensureLoaded(set: SetState<S>, get: GetState<S>): Promise<void>;
  refresh(set: SetState<S>, get: GetState<S>, showLoading?: boolean): Promise<void>;
  /** Initial values for the fields this template owns. */
  readonly initialState: WorkspaceCacheState;
}

const INITIAL_STATE: WorkspaceCacheState = {
  workspaceId: null,
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
};

export function createWorkspaceCache<S extends WorkspaceCacheState, T>(
  config: WorkspaceCacheConfig<S, T>,
): WorkspaceCache<S> {
  let inFlight: Promise<void> | null = null;
  let inFlightWorkspaceId: string | null = null;

  const refresh = async (
    set: SetState<S>,
    get: GetState<S>,
    showLoading = false,
  ): Promise<void> => {
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;

    if (inFlight) {
      // A flight for this workspace already answers the question. One for a
      // different workspace does not, so wait it out and ask again.
      if (inFlightWorkspaceId === workspaceId) return inFlight;
      await inFlight;
      return refresh(set, get, showLoading);
    }

    inFlightWorkspaceId = workspaceId;
    set({
      loading: showLoading && !get().loaded,
      refreshing: !showLoading || get().loaded,
      error: null,
    } as Partial<S>);

    inFlight = (async () => {
      try {
        const response = await config.load();
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || config.failureMessage);
        }
        // The workspace can change while this is in the air; applying a stale
        // response would show one workspace's data under another's name.
        if (useWorkspaceStore.getState().activeWorkspaceId === workspaceId) {
          set({ ...config.apply(response.data), workspaceId, loaded: true } as Partial<S>);
        }
      } catch (error) {
        logger.error(`[${config.label}] ${config.failureMessage}`, { error });
        set({
          error: error instanceof Error ? error.message : config.failureMessage,
        } as Partial<S>);
      } finally {
        set({ loading: false, refreshing: false } as Partial<S>);
        inFlight = null;
        inFlightWorkspaceId = null;
      }
    })();

    return inFlight;
  };

  return {
    refresh,
    ensureLoaded: async (set, get) => {
      const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const state = get();
      if (state.loaded && state.workspaceId === workspaceId) return;
      await refresh(set, get, true);
    },
    initialState: INITIAL_STATE,
  };
}
