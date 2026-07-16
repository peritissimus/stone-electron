import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import { DEFAULT_MEETINGS_CONFIG, type MeetingsConfig } from '@shared/types/settings';

interface MeetingsSettingsState {
  meetings: MeetingsConfig;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  setAudioRetentionDays: (days: number) => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;
let eventUnsubscribe: (() => void) | null = null;

async function loadMeetingsSettings(
  set: (state: Partial<MeetingsSettingsState>) => void,
): Promise<void> {
  try {
    const response = await settingsAPI.getMeetings();
    if (response.success && response.data) {
      set({ meetings: response.data, loaded: true, error: null });
      return;
    }
    set({ loaded: true, error: response.error?.message ?? 'Failed to load meeting settings' });
  } catch (error) {
    set({
      loaded: true,
      error: error instanceof Error ? error.message : 'Failed to load meeting settings',
    });
  }
}

export const useMeetingsSettingsStore = create<MeetingsSettingsState>((set, get) => ({
  meetings: DEFAULT_MEETINGS_CONFIG,
  loaded: false,
  saving: false,
  error: null,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      await loadMeetingsSettings(set);

      if (!eventUnsubscribe) {
        eventUnsubscribe = subscribe(EVENTS.SETTINGS_CHANGED, async (payload) => {
          const scope = (payload as { scope?: string } | undefined)?.scope;
          if (scope !== 'meetings') return;
          await loadMeetingsSettings(set);
        });
      }
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  setAudioRetentionDays: async (days) => {
    const previous = get().meetings;
    // Optimistic — reflect the choice immediately, roll back on failure.
    set({ meetings: { ...previous, audioRetentionDays: days }, saving: true, error: null });
    const response = await settingsAPI.updateMeetings({ audioRetentionDays: days });
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to update retention setting';
      set({ meetings: previous, saving: false, error: message });
      throw new Error(message);
    }
    set({ meetings: response.data, saving: false, error: null });
  },
}));
