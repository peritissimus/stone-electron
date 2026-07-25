import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { createSettingsHydrator } from '@renderer/services/settings/createSettingsHydrator';
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

const onboardingHydrator = createSettingsHydrator<OnboardingState, OnboardingConfig>({
  scope: 'onboarding',
  load: settingsAPI.getOnboarding,
  apply: (config, { set }) => set({ config, loaded: true, error: null }),
  fail: (error, { set }) => set({ loaded: true, error }),
  fallbackMessage: 'Failed to load onboarding state',
});

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  config: DEFAULT_ONBOARDING_CONFIG,
  loaded: false,
  error: null,

  hydrate: () => onboardingHydrator.hydrate(set, get),

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
