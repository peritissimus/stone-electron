import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { dailyReviewAPI } from '@renderer/api/dailyReviewAPI';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import type { CalendarDescriptor, DailyReviewIntegrationStatus } from '@shared/types/dailyReview';
import { DEFAULT_INTEGRATIONS_CONFIG, type IntegrationsConfig } from '@shared/types/settings';

export interface CalendarAccessState {
  status: 'idle' | 'loading' | DailyReviewIntegrationStatus;
  message: string | null;
}

interface IntegrationsSettingsState {
  integrations: IntegrationsConfig;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  calendarError: string | null;
  availableCalendars: CalendarDescriptor[];
  calendarAccess: CalendarAccessState;
  hydrate: () => Promise<void>;
  refreshCalendars: () => Promise<void>;
  setLinearApiKey: (key: string) => Promise<void>;
  setSelectedCalendarIds: (ids: string[] | null) => Promise<void>;
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
  calendarError: null,
  availableCalendars: [],
  calendarAccess: { status: 'idle', message: null },

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

  refreshCalendars: async () => {
    if (get().calendarAccess.status === 'loading') return;
    set({ calendarAccess: { status: 'loading', message: null } });
    try {
      const response = await dailyReviewAPI.listCalendars();
      if (!response.success || !response.data) {
        set({
          availableCalendars: [],
          calendarAccess: {
            status: 'error',
            message: response.error?.message ?? 'Could not load calendars.',
          },
        });
        return;
      }
      set({
        availableCalendars: response.data.calendars,
        calendarAccess: {
          status: response.data.status,
          message: response.data.message ?? null,
        },
      });
    } catch (error) {
      set({
        availableCalendars: [],
        calendarAccess: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load calendars.',
        },
      });
    }
  },

  setSelectedCalendarIds: async (ids) => {
    const previous = get().integrations;
    set({
      integrations: { ...previous, selectedCalendarIds: ids },
      saving: true,
      calendarError: null,
    });
    const response = await settingsAPI.updateIntegrations({ selectedCalendarIds: ids });
    if (!response.success || !response.data) {
      const message = response.error?.message ?? 'Failed to save calendar selection';
      set({ integrations: previous, saving: false, calendarError: message });
      return;
    }
    set({ integrations: response.data, saving: false, calendarError: null });
  },
}));
