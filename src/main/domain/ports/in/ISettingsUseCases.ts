/**
 * Settings Use Cases Port
 *
 * Defines the contract for settings operations.
 */

export interface SettingDTO {
  key: string;
  value: string;
  updatedAt: number; // Unix timestamp
}

export interface IGetSettingUseCase {
  execute(request: { key: string }): Promise<{ value: string | null }>;
}

export interface ISetSettingUseCase {
  execute(request: { key: string; value: string }): Promise<void>;
}

export interface IGetAllSettingsUseCase {
  execute(): Promise<{ settings: SettingDTO[] }>;
}

export interface IGetAppearanceSettingsUseCase {
  execute(): Promise<import('@shared/types/settings').AppearanceSettings>;
}

export interface ISetThemeUseCase {
  execute(request: { theme: import('@shared/types/settings').AppTheme }): Promise<void>;
}

export interface ISetAccentColorUseCase {
  execute(request: { accentColor: import('@shared/types/settings').AppAccentColor }): Promise<void>;
}

export interface IUpdateFontSettingsUseCase {
  execute(request: { fontSettings: Partial<import('@shared/types/settings').FontSettings> }): Promise<void>;
}

export interface IResetFontSettingsUseCase {
  execute(): Promise<void>;
}

/**
 * Aggregated settings use cases interface for DI container
 */
export interface ISettingsUseCases {
  get: IGetSettingUseCase;
  set: ISetSettingUseCase;
  getAll: IGetAllSettingsUseCase;
  getAppearance: IGetAppearanceSettingsUseCase;
  setTheme: ISetThemeUseCase;
  setAccentColor: ISetAccentColorUseCase;
  updateFontSettings: IUpdateFontSettingsUseCase;
  resetFontSettings: IResetFontSettingsUseCase;
}
