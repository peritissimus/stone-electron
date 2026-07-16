import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import { DEFAULT_INTEGRATIONS_CONFIG, type IntegrationsConfig } from '@shared/types/settings';

interface IntegrationsSettingsState {
  integrations: IntegrationsConfig;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  setLinearApiKey: (key: string) => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;
let eventUnsubscribe: (() => void) | null = null;

async function loadIntegrations(
  set: (state: Partial<IntegrationsSettingsState>) => void,
): Promise<void> {
  try {
    const response = await settingsAPI.getIntegrations();
    if (response.success && response.data) {
      set({ integrations: response.data, loaded: true, error: null });
      return;
    }
    set({ loaded: true, error: response.error?.message ?? 'Failed to load integrations' });
  } catch (error) {
    set({
      loaded: true,
      error: error instanceof Error ? error.message : 'Failed to load integrations',
    });
  }
}

export const useIntegrationsSettingsStore = create<IntegrationsSettingsState>((set, get) => ({
  integrations: DEFAULT_INTEGRATIONS_CONFIG,
  loaded: false,
  saving: false,
  error: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      await loadIntegrations(set);
      if (!eventUnsubscribe) {
        eventUnsubscribe = subscribe(EVENTS.SETTINGS_CHANGED, async (payload) => {
          const scope = (payload as { scope?: string } | undefined)?.scope;
          if (scope !== 'integrations') return;
          await loadIntegrations(set);
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  setLinearApiKey: async (key) => {
    const previous = get().integrations;
    set({ saving: true, error: null });
    const response = await settingsAPI.updateIntegrations({ linearApiKey: key });
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to save Linear API key';
      set({ integrations: previous, saving: false, error: message });
      throw new Error(message);
    }
    set({ integrations: response.data, saving: false, error: null });
  },
}));
