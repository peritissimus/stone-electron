/**
 * Settings Use Cases Port
 *
 * Defines the contract for settings operations.
 */

import type {
  AppearanceSettings,
  AppAccentColor,
  AppTheme,
  ChordBinding,
  EditorSettings,
  FontSettings,
  ShortcutsConfig,
} from '../../value-objects/AppConfig';

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
  execute(): Promise<AppearanceSettings>;
}

export interface ISetThemeUseCase {
  execute(request: { theme: AppTheme }): Promise<void>;
}

export interface ISetAccentColorUseCase {
  execute(request: { accentColor: AppAccentColor }): Promise<void>;
}

export interface IUpdateFontSettingsUseCase {
  execute(request: { fontSettings: Partial<FontSettings> }): Promise<void>;
}

export interface IResetFontSettingsUseCase {
  execute(): Promise<void>;
}

// ----- editor settings -----

export interface IGetEditorSettingsUseCase {
  execute(): Promise<EditorSettings>;
}

export interface IUpdateEditorSettingsUseCase {
  execute(request: {
    editor: Partial<EditorSettings>;
  }): Promise<EditorSettings>;
}

export interface IResetEditorSettingsUseCase {
  execute(): Promise<EditorSettings>;
}

// ----- shortcuts -----

export type ShortcutsScope = 'app' | 'editor';

export interface IGetShortcutsUseCase {
  execute(): Promise<ShortcutsConfig>;
}

export interface ISetShortcutUseCase {
  execute(request: {
    scope: ShortcutsScope;
    action: string;
    binding: ChordBinding | ChordBinding[];
  }): Promise<ShortcutsConfig>;
}

export interface IResetShortcutUseCase {
  execute(request: {
    scope: ShortcutsScope;
    action: string;
  }): Promise<ShortcutsConfig>;
}

export interface IResetAllShortcutsUseCase {
  execute(): Promise<ShortcutsConfig>;
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
  getEditor: IGetEditorSettingsUseCase;
  updateEditor: IUpdateEditorSettingsUseCase;
  resetEditor: IResetEditorSettingsUseCase;
  getShortcuts: IGetShortcutsUseCase;
  setShortcut: ISetShortcutUseCase;
  resetShortcut: IResetShortcutUseCase;
  resetAllShortcuts: IResetAllShortcutsUseCase;
}
