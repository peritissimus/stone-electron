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

// ----- editor settings -----

export interface IGetEditorSettingsUseCase {
  execute(): Promise<import('@shared/types/settings').EditorSettings>;
}

export interface IUpdateEditorSettingsUseCase {
  execute(request: {
    editor: Partial<import('@shared/types/settings').EditorSettings>;
  }): Promise<import('@shared/types/settings').EditorSettings>;
}

export interface IResetEditorSettingsUseCase {
  execute(): Promise<import('@shared/types/settings').EditorSettings>;
}

// ----- shortcuts -----

export type ShortcutsScope = 'app' | 'editor';

export interface IGetShortcutsUseCase {
  execute(): Promise<import('@shared/types/settings').ShortcutsConfig>;
}

export interface ISetShortcutUseCase {
  execute(request: {
    scope: ShortcutsScope;
    action: string;
    binding:
      | import('@shared/types/settings').ChordBinding
      | import('@shared/types/settings').ChordBinding[];
  }): Promise<import('@shared/types/settings').ShortcutsConfig>;
}

export interface IResetShortcutUseCase {
  execute(request: {
    scope: ShortcutsScope;
    action: string;
  }): Promise<import('@shared/types/settings').ShortcutsConfig>;
}

export interface IResetAllShortcutsUseCase {
  execute(): Promise<import('@shared/types/settings').ShortcutsConfig>;
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
