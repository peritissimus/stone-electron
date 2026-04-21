import { create } from 'zustand';
import { settingsAPI } from '@renderer/api/settingsAPI';
import { readLegacyAppearanceSettings } from '@renderer/lib/legacyAppearanceSettings';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
  type AppAccentColor,
  type AppTheme,
  type FontSettings,
} from '@shared/types/settings';

interface SettingsState {
  appearance: AppearanceSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: AppTheme) => Promise<void>;
  setAccentColor: (accentColor: AppAccentColor) => Promise<void>;
  setFontSettings: (fontSettings: Partial<FontSettings>) => Promise<void>;
  resetFontSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  hydrated: false,

  hydrate: async () => {
    const response = await settingsAPI.getAppearance();
    const appearance = response.success && response.data ? response.data : DEFAULT_APPEARANCE_SETTINGS;
    const legacyAppearance = readLegacyAppearanceSettings();
    const shouldMigrate =
      JSON.stringify(appearance) === JSON.stringify(DEFAULT_APPEARANCE_SETTINGS) && legacyAppearance;

    if (shouldMigrate) {
      set({ appearance: legacyAppearance, hydrated: true });
      await Promise.all([
        settingsAPI.setTheme(legacyAppearance.theme),
        settingsAPI.setAccentColor(legacyAppearance.accentColor),
        settingsAPI.updateFontSettings(legacyAppearance.fontSettings),
      ]);
      return;
    }

    set({ appearance, hydrated: true });
  },

  setTheme: async (theme) => {
    set((state) => ({ appearance: { ...state.appearance, theme } }));
    const response = await settingsAPI.setTheme(theme);
    if (!response.success) {
      await get().hydrate();
    }
  },

  setAccentColor: async (accentColor) => {
    set((state) => ({ appearance: { ...state.appearance, accentColor } }));
    const response = await settingsAPI.setAccentColor(accentColor);
    if (!response.success) {
      await get().hydrate();
    }
  },

  setFontSettings: async (fontSettings) => {
    set((state) => ({
      appearance: {
        ...state.appearance,
        fontSettings: { ...state.appearance.fontSettings, ...fontSettings },
      },
    }));

    const response = await settingsAPI.updateFontSettings(fontSettings);
    if (!response.success) {
      await get().hydrate();
    }
  },

  resetFontSettings: async () => {
    set((state) => ({
      appearance: {
        ...state.appearance,
        fontSettings: DEFAULT_APPEARANCE_SETTINGS.fontSettings,
      },
    }));

    const response = await settingsAPI.resetFontSettings();
    if (!response.success) {
      await get().hydrate();
    }
  },
}));
