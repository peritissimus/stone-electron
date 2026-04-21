import {
  DEFAULT_APPEARANCE_SETTINGS,
  type AppearanceSettings,
} from '@shared/types/settings';

interface LegacyUIPreferences {
  theme?: AppearanceSettings['theme'];
  accentColor?: AppearanceSettings['accentColor'];
  fontSettings?: AppearanceSettings['fontSettings'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readLegacyAppearanceSettings(): AppearanceSettings | null {
  const raw = window.localStorage.getItem('stone-ui-preferences');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const state = isRecord(parsed) && isRecord(parsed.state) ? parsed.state : null;
    if (!state) return null;

    const legacy = state as LegacyUIPreferences;
    const hasAppearance =
      typeof legacy.theme === 'string' ||
      typeof legacy.accentColor === 'string' ||
      isRecord(legacy.fontSettings);

    if (!hasAppearance) return null;

    return {
      theme: legacy.theme ?? DEFAULT_APPEARANCE_SETTINGS.theme,
      accentColor: legacy.accentColor ?? DEFAULT_APPEARANCE_SETTINGS.accentColor,
      fontSettings: {
        ...DEFAULT_APPEARANCE_SETTINGS.fontSettings,
        ...(legacy.fontSettings ?? {}),
      },
    };
  } catch {
    return null;
  }
}
