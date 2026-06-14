/**
 * Settings Use Cases Port
 *
 * Defines the contract for settings operations.
 */

import type {
  AIConfig,
  AppearanceSettings,
  AppAccentColor,
  AppTheme,
  ChordBinding,
  EditorSettings,
  FontSettings,
  MeetingsConfig,
  ShortcutsConfig,
} from '../../value-objects/AppConfig';
import type { AIProviderId, AIProviderKeyStatus } from '../out/IAIProviderKeyStore';

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

// ----- AI -----

export interface IGetAISettingsUseCase {
  execute(): Promise<AIConfig>;
}

export interface IUpdateAISettingsUseCase {
  execute(request: {
    ai: Partial<AIConfig>;
  }): Promise<AIConfig>;
}

export interface IResetAISettingsUseCase {
  execute(): Promise<AIConfig>;
}

export interface IGetAIProviderKeysUseCase {
  execute(): Promise<AIProviderKeyStatus[]>;
}

export interface ISetAIProviderKeyUseCase {
  execute(request: {
    provider: AIProviderId;
    apiKey: string;
  }): Promise<AIProviderKeyStatus[]>;
}

export interface IDeleteAIProviderKeyUseCase {
  execute(request: {
    provider: AIProviderId;
  }): Promise<AIProviderKeyStatus[]>;
}

// ----- meetings -----

export interface IGetMeetingsSettingsUseCase {
  execute(): Promise<MeetingsConfig>;
}

export interface IUpdateMeetingsSettingsUseCase {
  execute(request: { meetings: Partial<MeetingsConfig> }): Promise<MeetingsConfig>;
}

export interface IResetMeetingsSettingsUseCase {
  execute(): Promise<MeetingsConfig>;
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
  getAI: IGetAISettingsUseCase;
  updateAI: IUpdateAISettingsUseCase;
  resetAI: IResetAISettingsUseCase;
  getAIProviderKeys: IGetAIProviderKeysUseCase;
  setAIProviderKey: ISetAIProviderKeyUseCase;
  deleteAIProviderKey: IDeleteAIProviderKeyUseCase;
  getMeetings: IGetMeetingsSettingsUseCase;
  updateMeetings: IUpdateMeetingsSettingsUseCase;
  resetMeetings: IResetMeetingsSettingsUseCase;
}
