import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { createSettingsHydrator } from '@renderer/services/settings/createSettingsHydrator';
import { DEFAULT_MEETINGS_CONFIG, type MeetingsConfig } from '@shared/types/settings';

interface MeetingsSettingsState {
  meetings: MeetingsConfig;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  setAudioRetentionDays: (days: number) => Promise<void>;
}

const meetingsHydrator = createSettingsHydrator<MeetingsSettingsState, MeetingsConfig>({
  scope: 'meetings',
  load: settingsAPI.getMeetings,
  apply: (meetings, { set }) => set({ meetings, loaded: true, error: null }),
  fail: (error, { set }) => set({ loaded: true, error }),
  fallbackMessage: 'Failed to load meeting settings',
});

export const useMeetingsSettingsStore = create<MeetingsSettingsState>((set, get) => ({
  meetings: DEFAULT_MEETINGS_CONFIG,
  loaded: false,
  saving: false,
  error: null,

  hydrate: () => meetingsHydrator.hydrate(set, get),

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
