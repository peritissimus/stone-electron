import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_FONT_SETTINGS,
  type AppearanceSettings,
  type AppAccentColor,
  type AppTheme,
  type FontSettings,
} from '@shared/types/settings';

const APPEARANCE_KEYS = {
  theme: 'appearance.theme',
  accentColor: 'appearance.accentColor',
  fontSettings: 'appearance.fontSettings',
} as const;

function isTheme(value: string | null | undefined): value is AppTheme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isAccentColor(value: string | null | undefined): value is AppAccentColor {
  return (
    value === 'blue' ||
    value === 'purple' ||
    value === 'pink' ||
    value === 'red' ||
    value === 'orange' ||
    value === 'green' ||
    value === 'teal'
  );
}

async function getAppearanceSettings(repository: ISettingsRepository): Promise<AppearanceSettings> {
  const [themeSetting, accentColorSetting, fontSettingsSetting] = await Promise.all([
    repository.get(APPEARANCE_KEYS.theme),
    repository.get(APPEARANCE_KEYS.accentColor),
    repository.get(APPEARANCE_KEYS.fontSettings),
  ]);

  let fontSettings = DEFAULT_FONT_SETTINGS;

  if (fontSettingsSetting?.value) {
    try {
      fontSettings = { ...DEFAULT_FONT_SETTINGS, ...JSON.parse(fontSettingsSetting.value) };
    } catch {
      fontSettings = DEFAULT_FONT_SETTINGS;
    }
  }

  return {
    theme: isTheme(themeSetting?.value) ? themeSetting.value : DEFAULT_APPEARANCE_SETTINGS.theme,
    accentColor: isAccentColor(accentColorSetting?.value)
      ? accentColorSetting.value
      : DEFAULT_APPEARANCE_SETTINGS.accentColor,
    fontSettings,
  };
}

export class GetAppearanceSettingsUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(): Promise<AppearanceSettings> {
    return getAppearanceSettings(this.settingsRepository);
  }
}

export class SetThemeUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(request: { theme: AppTheme }): Promise<void> {
    await this.settingsRepository.set(APPEARANCE_KEYS.theme, request.theme);
  }
}

export class SetAccentColorUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(request: { accentColor: AppAccentColor }): Promise<void> {
    await this.settingsRepository.set(APPEARANCE_KEYS.accentColor, request.accentColor);
  }
}

export class UpdateFontSettingsUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(request: { fontSettings: Partial<FontSettings> }): Promise<void> {
    const appearance = await getAppearanceSettings(this.settingsRepository);
    const nextFontSettings = { ...appearance.fontSettings, ...request.fontSettings };

    await this.settingsRepository.set(APPEARANCE_KEYS.fontSettings, JSON.stringify(nextFontSettings));
  }
}

export class ResetFontSettingsUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(): Promise<void> {
    await this.settingsRepository.set(
      APPEARANCE_KEYS.fontSettings,
      JSON.stringify(DEFAULT_FONT_SETTINGS),
    );
  }
}
