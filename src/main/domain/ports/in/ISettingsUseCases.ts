/**
 * Settings Use Cases Port
 *
 * Defines the contract for settings operations.
 */

import { Context } from 'effect';
import type { Effect } from 'effect';
import type {
  AIConfig,
  AppearanceSettings,
  AppAccentColor,
  AppTheme,
  ChordBinding,
  EditorSettings,
  FontSettings,
  IntegrationsConfig,
  MeetingsConfig,
  OnboardingConfig,
  OnboardingStepState,
  ShortcutsConfig,
} from '../../value-objects/AppConfig';
import type { AIProviderId, AIProviderKeyStatus } from '../out/IAIProviderKeyStore';
import type { QuickCaptureShortcutStatus } from '../out/IGlobalShortcutRegistrar';

export interface SettingDTO {
  key: string;
  value: string;
  updatedAt: number; // Unix timestamp
}

export interface IGetSettingUseCase {
  execute(request: { key: string }): Effect.Effect<{ value: string | null }, Error>;
}

export interface ISetSettingUseCase {
  execute(request: { key: string; value: string }): Effect.Effect<void, Error>;
}

export interface IGetAllSettingsUseCase {
  execute(): Effect.Effect<{ settings: SettingDTO[] }, Error>;
}

export interface IGetAppearanceSettingsUseCase {
  execute(): Effect.Effect<AppearanceSettings, Error>;
}

export interface ISetThemeUseCase {
  execute(request: { theme: AppTheme }): Effect.Effect<void, Error>;
}

export interface ISetAccentColorUseCase {
  execute(request: { accentColor: AppAccentColor }): Effect.Effect<void, Error>;
}

export interface IUpdateFontSettingsUseCase {
  execute(request: { fontSettings: Partial<FontSettings> }): Effect.Effect<void, Error>;
}

export interface IResetFontSettingsUseCase {
  execute(): Effect.Effect<void, Error>;
}

// ----- editor settings -----

export interface IGetEditorSettingsUseCase {
  execute(): Effect.Effect<EditorSettings, Error>;
}

export interface IUpdateEditorSettingsUseCase {
  execute(request: {
    editor: Partial<EditorSettings>;
  }): Effect.Effect<EditorSettings, Error>;
}

export interface IResetEditorSettingsUseCase {
  execute(): Effect.Effect<EditorSettings, Error>;
}

// ----- shortcuts -----

export type ShortcutsScope = 'app' | 'editor';

export interface IGetShortcutsUseCase {
  execute(): Effect.Effect<ShortcutsConfig, Error>;
}

export interface ISetShortcutUseCase {
  execute(request: {
    scope: ShortcutsScope;
    action: string;
    binding: ChordBinding | ChordBinding[];
  }): Effect.Effect<ShortcutsConfig, Error>;
}

export interface IResetShortcutUseCase {
  execute(request: {
    scope: ShortcutsScope;
    action: string;
  }): Effect.Effect<ShortcutsConfig, Error>;
}

export interface IResetAllShortcutsUseCase {
  execute(): Effect.Effect<ShortcutsConfig, Error>;
}

// ----- AI -----

export interface IGetAISettingsUseCase {
  execute(): Effect.Effect<AIConfig, Error>;
}

export interface IUpdateAISettingsUseCase {
  execute(request: {
    ai: Partial<AIConfig>;
  }): Effect.Effect<AIConfig, Error>;
}

export interface IResetAISettingsUseCase {
  execute(): Effect.Effect<AIConfig, Error>;
}

export interface IGetAIProviderKeysUseCase {
  execute(): Effect.Effect<AIProviderKeyStatus[], Error>;
}

export interface ISetAIProviderKeyUseCase {
  execute(request: {
    provider: AIProviderId;
    apiKey: string;
  }): Effect.Effect<AIProviderKeyStatus[], Error>;
}

export interface IDeleteAIProviderKeyUseCase {
  execute(request: {
    provider: AIProviderId;
  }): Effect.Effect<AIProviderKeyStatus[], Error>;
}

// ----- meetings -----

export interface IGetMeetingsSettingsUseCase {
  execute(): Effect.Effect<MeetingsConfig, Error>;
}

export interface IUpdateMeetingsSettingsUseCase {
  execute(request: { meetings: Partial<MeetingsConfig> }): Effect.Effect<MeetingsConfig, Error>;
}

export interface IResetMeetingsSettingsUseCase {
  execute(): Effect.Effect<MeetingsConfig, Error>;
}

export interface IGetIntegrationsSettingsUseCase {
  execute(): Effect.Effect<IntegrationsConfig, Error>;
}

export interface IUpdateIntegrationsSettingsUseCase {
  execute(request: { integrations: Partial<IntegrationsConfig> }): Effect.Effect<IntegrationsConfig, Error>;
}

// ----- onboarding -----

export interface IGetOnboardingUseCase {
  execute(): Effect.Effect<OnboardingConfig, Error>;
}

export interface IUpdateOnboardingUseCase {
  execute(request: {
    onboarding: { completed?: boolean; steps?: Partial<OnboardingStepState> };
  }): Effect.Effect<OnboardingConfig, Error>;
}

export interface IResetOnboardingUseCase {
  execute(): Effect.Effect<OnboardingConfig, Error>;
}

// ----- quick capture (global hotkey) -----

export interface IGetQuickCaptureShortcutUseCase {
  execute(): Effect.Effect<QuickCaptureShortcutStatus, Error>;
}

export interface ISetQuickCaptureShortcutUseCase {
  execute(request: { shortcut: string }): Effect.Effect<QuickCaptureShortcutStatus, Error>;
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
  getIntegrations: IGetIntegrationsSettingsUseCase;
  updateIntegrations: IUpdateIntegrationsSettingsUseCase;
  getOnboarding: IGetOnboardingUseCase;
  updateOnboarding: IUpdateOnboardingUseCase;
  resetOnboarding: IResetOnboardingUseCase;
  getQuickCaptureShortcut: IGetQuickCaptureShortcutUseCase;
  setQuickCaptureShortcut: ISetQuickCaptureShortcutUseCase;
}

export const SettingsUseCasesPort =
  Context.GenericTag<ISettingsUseCases>('stone/ISettingsUseCases');
