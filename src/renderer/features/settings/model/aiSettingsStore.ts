import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  DEFAULT_AI_CONFIG,
  type AIConfig,
  type AIIndexingConfig,
  type AIModelConfig,
  type AIProviderId,
  type AIProviderKeyStatus,
  type AIPrivacyConfig,
} from '@shared/types/settings';

interface AISettingsState {
  ai: AIConfig;
  providerKeys: AIProviderKeyStatus[];
  loaded: boolean;
  keysLoaded: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  hydrateProviderKeys: () => Promise<void>;
  updateIndexing: (indexing: Partial<AIIndexingConfig>) => Promise<void>;
  updateModels: (models: Partial<AIModelConfig>) => Promise<void>;
  updatePrivacy: (privacy: Partial<AIPrivacyConfig>) => Promise<void>;
  setProviderKey: (provider: AIProviderId, apiKey: string) => Promise<void>;
  deleteProviderKey: (provider: AIProviderId) => Promise<void>;
  resetAI: () => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;
let keyHydrationPromise: Promise<void> | null = null;
let eventUnsubscribe: (() => void) | null = null;

async function loadAISettings(
  set: (state: Partial<AISettingsState>) => void,
): Promise<AIConfig | null> {
  try {
    const response = await settingsAPI.getAI();
    if (response.success && response.data) {
      set({ ai: response.data, loaded: true, error: null });
      return response.data;
    }
    set({
      loaded: true,
      error: response.error?.message ?? 'Failed to load AI settings',
    });
  } catch (error) {
    set({
      loaded: true,
      error: error instanceof Error ? error.message : 'Failed to load AI settings',
    });
  }
  return null;
}

async function loadProviderKeys(
  set: (state: Partial<AISettingsState>) => void,
): Promise<AIProviderKeyStatus[] | null> {
  try {
    const response = await settingsAPI.getAIProviderKeys();
    if (response.success && response.data) {
      set({ providerKeys: response.data, keysLoaded: true, error: null });
      return response.data;
    }
    set({
      keysLoaded: true,
      error: response.error?.message ?? 'Failed to load AI provider keys',
    });
  } catch (error) {
    set({
      keysLoaded: true,
      error: error instanceof Error ? error.message : 'Failed to load AI provider keys',
    });
  }
  return null;
}

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
  ai: DEFAULT_AI_CONFIG,
  providerKeys: [],
  loaded: false,
  keysLoaded: false,
  saving: false,
  error: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      await Promise.all([loadAISettings(set), loadProviderKeys(set)]);

      if (!eventUnsubscribe) {
        eventUnsubscribe = subscribe(EVENTS.SETTINGS_CHANGED, async (payload) => {
          const scope = (payload as { scope?: string } | undefined)?.scope;
          if (scope !== 'ai') return;
          await Promise.all([loadAISettings(set), loadProviderKeys(set)]);
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  hydrateProviderKeys: async () => {
    if (keyHydrationPromise) return keyHydrationPromise;

    keyHydrationPromise = (async () => {
      await loadProviderKeys(set);
    })();

    try {
      await keyHydrationPromise;
    } finally {
      keyHydrationPromise = null;
    }
  },

  updateIndexing: async (indexing) => {
    const nextIndexing = { ...get().ai.indexing, ...indexing };
    set({ saving: true, error: null });
    const response = await settingsAPI.updateAI({ indexing: nextIndexing });
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to update AI indexing settings';
      set({ saving: false, error: message });
      throw new Error(message);
    }
    set({ ai: response.data, saving: false, error: null });
  },

  updateModels: async (models) => {
    const nextModels = { ...get().ai.models, ...models };
    set({ saving: true, error: null });
    const response = await settingsAPI.updateAI({ models: nextModels });
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to update AI model settings';
      set({ saving: false, error: message });
      throw new Error(message);
    }
    set({ ai: response.data, saving: false, error: null });
  },

  updatePrivacy: async (privacy) => {
    const nextPrivacy = { ...get().ai.privacy, ...privacy };
    set({ saving: true, error: null });
    const response = await settingsAPI.updateAI({ privacy: nextPrivacy });
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to update AI privacy settings';
      set({ saving: false, error: message });
      throw new Error(message);
    }
    set({ ai: response.data, saving: false, error: null });
  },

  setProviderKey: async (provider, apiKey) => {
    set({ saving: true, error: null });
    const response = await settingsAPI.setAIProviderKey(provider, apiKey);
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to save AI provider key';
      set({ saving: false, error: message });
      throw new Error(message);
    }
    set({ providerKeys: response.data, keysLoaded: true, saving: false, error: null });
  },

  deleteProviderKey: async (provider) => {
    set({ saving: true, error: null });
    const response = await settingsAPI.deleteAIProviderKey(provider);
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to delete AI provider key';
      set({ saving: false, error: message });
      throw new Error(message);
    }
    set({ providerKeys: response.data, keysLoaded: true, saving: false, error: null });
  },

  resetAI: async () => {
    set({ saving: true, error: null });
    const response = await settingsAPI.resetAI();
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to reset AI settings';
      set({ saving: false, error: message });
      throw new Error(message);
    }
    set({ ai: response.data, saving: false, error: null });
  },
}));
