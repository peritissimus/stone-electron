import type { IpcResponse } from '@shared/types';
import { EVENTS } from '@shared/constants/ipcChannels';
import { subscribe } from '@renderer/lib/events';

type SetState<S> = (update: Partial<S> | ((state: S) => Partial<S>)) => void;
type GetState<S> = () => S;

export interface SettingsHydratorConfig<S, T> {
  scope: string;
  load: () => Promise<IpcResponse<T>>;
  apply: (data: T, context: { event: boolean; set: SetState<S>; get: GetState<S> }) => void;
  fail: (message: string, context: { set: SetState<S>; get: GetState<S> }) => void;
  fallbackMessage: string;
}

export interface SettingsHydrator<S> {
  hydrate(set: SetState<S>, get: GetState<S>): Promise<void>;
}

/** Shared single-flight hydrate + settings:changed subscription template. */
export function createSettingsHydrator<S, T>(
  config: SettingsHydratorConfig<S, T>,
): SettingsHydrator<S> {
  let inFlight: Promise<void> | null = null;
  let unsubscribe: (() => void) | null = null;

  const reload = async (set: SetState<S>, get: GetState<S>, event: boolean) => {
    try {
      const response = await config.load();
      if (response.success && response.data !== undefined) {
        config.apply(response.data, { event, set, get });
        return;
      }
      config.fail(response.error?.message ?? config.fallbackMessage, { set, get });
    } catch (error) {
      config.fail(error instanceof Error ? error.message : config.fallbackMessage, { set, get });
    }
  };

  return {
    hydrate(set, get) {
      if (inFlight) return inFlight;
      inFlight = (async () => {
        await reload(set, get, false);
        if (!unsubscribe) {
          unsubscribe = subscribe(EVENTS.SETTINGS_CHANGED, (payload) => {
            const scope = (payload as { scope?: string } | undefined)?.scope;
            if (scope === config.scope) void reload(set, get, true);
          });
        }
      })().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
