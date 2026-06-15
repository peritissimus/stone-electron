import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  DEFAULT_ONBOARDING_CONFIG,
  type OnboardingConfig,
  type OnboardingStepState,
} from '@shared/types/settings';

interface OnboardingState {
  config: OnboardingConfig;
  loaded: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  /** Mark one or more steps complete (persisted). */
  markSteps: (steps: Partial<OnboardingStepState>) => Promise<void>;
  /** Mark the whole wizard complete (stamps completedAt server-side). */
  complete: () => Promise<void>;
  /** Reset to a fresh, never-onboarded state (re-runs the wizard). */
  reset: () => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;
let eventUnsubscribe: (() => void) | null = null;

async function load(set: (state: Partial<OnboardingState>) => void): Promise<void> {
  try {
    const response = await settingsAPI.getOnboarding();
    if (response.success && response.data) {
      set({ config: response.data, loaded: true, error: null });
      return;
    }
    set({ loaded: true, error: response.error?.message ?? 'Failed to load onboarding state' });
  } catch (error) {
    set({
      loaded: true,
      error: error instanceof Error ? error.message : 'Failed to load onboarding state',
    });
  }
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  config: DEFAULT_ONBOARDING_CONFIG,
  loaded: false,
  error: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      await load(set);
      if (!eventUnsubscribe) {
        eventUnsubscribe = subscribe(EVENTS.SETTINGS_CHANGED, async (payload) => {
          const scope = (payload as { scope?: string } | undefined)?.scope;
          if (scope !== 'onboarding') return;
          await load(set);
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  markSteps: async (steps) => {
    const response = await settingsAPI.updateOnboarding({ steps });
    if (response.success && response.data) {
      set({ config: response.data, error: null });
    }
  },

  complete: async () => {
    const response = await settingsAPI.updateOnboarding({ completed: true });
    if (response.success && response.data) {
      set({ config: response.data, error: null });
    }
  },

  reset: async () => {
    const response = await settingsAPI.resetOnboarding();
    if (response.success && response.data) {
      set({ config: response.data, error: null });
    }
  },
}));
