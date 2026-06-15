import type {
  IAIProviderKeyStore,
  IAppConfigRepository,
  IGlobalShortcutRegistrar,
  ISettingsRepository,
} from '../../../domain/ports/out';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { ISettingsUseCases } from '../../../domain/ports/in/ISettingsUseCases';
import { GetSettingUseCase } from './GetSettingUseCase';
import { SetSettingUseCase } from './SetSettingUseCase';
import { GetAllSettingsUseCase } from './GetAllSettingsUseCase';
import {
  GetAppearanceSettingsUseCase,
  SetThemeUseCase,
  SetAccentColorUseCase,
  UpdateFontSettingsUseCase,
  ResetFontSettingsUseCase,
} from './appearance';
import {
  GetEditorSettingsUseCase,
  UpdateEditorSettingsUseCase,
  ResetEditorSettingsUseCase,
} from './editor';
import {
  GetShortcutsUseCase,
  SetShortcutUseCase,
  ResetShortcutUseCase,
  ResetAllShortcutsUseCase,
} from './shortcuts';
import {
  DeleteAIProviderKeyUseCase,
  GetAIProviderKeysUseCase,
  GetAISettingsUseCase,
  ResetAISettingsUseCase,
  SetAIProviderKeyUseCase,
  UpdateAISettingsUseCase,
} from './ai';
import {
  GetMeetingsSettingsUseCase,
  ResetMeetingsSettingsUseCase,
  UpdateMeetingsSettingsUseCase,
} from './meetings';
import {
  GetOnboardingUseCase,
  ResetOnboardingUseCase,
  UpdateOnboardingUseCase,
} from './onboarding';
import {
  GetQuickCaptureShortcutUseCase,
  SetQuickCaptureShortcutUseCase,
} from './quickCapture';

export { GetSettingUseCase } from './GetSettingUseCase';
export { SetSettingUseCase } from './SetSettingUseCase';
export { GetAllSettingsUseCase } from './GetAllSettingsUseCase';
export {
  GetAppearanceSettingsUseCase,
  SetThemeUseCase,
  SetAccentColorUseCase,
  UpdateFontSettingsUseCase,
  ResetFontSettingsUseCase,
} from './appearance';
export {
  GetEditorSettingsUseCase,
  UpdateEditorSettingsUseCase,
  ResetEditorSettingsUseCase,
} from './editor';
export {
  GetShortcutsUseCase,
  SetShortcutUseCase,
  ResetShortcutUseCase,
  ResetAllShortcutsUseCase,
} from './shortcuts';
export {
  DeleteAIProviderKeyUseCase,
  GetAIProviderKeysUseCase,
  GetAISettingsUseCase,
  ResetAISettingsUseCase,
  SetAIProviderKeyUseCase,
  UpdateAISettingsUseCase,
} from './ai';
export {
  GetMeetingsSettingsUseCase,
  ResetMeetingsSettingsUseCase,
  UpdateMeetingsSettingsUseCase,
} from './meetings';
export {
  GetOnboardingUseCase,
  ResetOnboardingUseCase,
  UpdateOnboardingUseCase,
  type OnboardingPatch,
} from './onboarding';
export {
  GetQuickCaptureShortcutUseCase,
  SetQuickCaptureShortcutUseCase,
} from './quickCapture';

export interface SettingsUseCasesDeps {
  settingsRepository: ISettingsRepository;
  appConfigRepository: IAppConfigRepository;
  aiProviderKeyStore: IAIProviderKeyStore;
  globalShortcutRegistrar: IGlobalShortcutRegistrar;
  eventPublisher?: IEventPublisher;
}

export function createSettingsUseCases(deps: SettingsUseCasesDeps): ISettingsUseCases {
  const {
    settingsRepository,
    appConfigRepository,
    aiProviderKeyStore,
    globalShortcutRegistrar,
    eventPublisher,
  } = deps;

  return {
    get: new GetSettingUseCase(settingsRepository),
    set: new SetSettingUseCase(settingsRepository),
    getAll: new GetAllSettingsUseCase(settingsRepository),
    getAppearance: new GetAppearanceSettingsUseCase(appConfigRepository),
    setTheme: new SetThemeUseCase(appConfigRepository, eventPublisher),
    setAccentColor: new SetAccentColorUseCase(appConfigRepository, eventPublisher),
    updateFontSettings: new UpdateFontSettingsUseCase(appConfigRepository, eventPublisher),
    resetFontSettings: new ResetFontSettingsUseCase(appConfigRepository, eventPublisher),
    getEditor: new GetEditorSettingsUseCase(appConfigRepository),
    updateEditor: new UpdateEditorSettingsUseCase(appConfigRepository, eventPublisher),
    resetEditor: new ResetEditorSettingsUseCase(appConfigRepository, eventPublisher),
    getShortcuts: new GetShortcutsUseCase(appConfigRepository),
    setShortcut: new SetShortcutUseCase(appConfigRepository, eventPublisher),
    resetShortcut: new ResetShortcutUseCase(appConfigRepository, eventPublisher),
    resetAllShortcuts: new ResetAllShortcutsUseCase(appConfigRepository, eventPublisher),
    getAI: new GetAISettingsUseCase(appConfigRepository),
    updateAI: new UpdateAISettingsUseCase(appConfigRepository, eventPublisher),
    resetAI: new ResetAISettingsUseCase(appConfigRepository, eventPublisher),
    getAIProviderKeys: new GetAIProviderKeysUseCase(aiProviderKeyStore),
    setAIProviderKey: new SetAIProviderKeyUseCase(aiProviderKeyStore, eventPublisher),
    deleteAIProviderKey: new DeleteAIProviderKeyUseCase(aiProviderKeyStore, eventPublisher),
    getMeetings: new GetMeetingsSettingsUseCase(appConfigRepository),
    updateMeetings: new UpdateMeetingsSettingsUseCase(appConfigRepository, eventPublisher),
    resetMeetings: new ResetMeetingsSettingsUseCase(appConfigRepository, eventPublisher),
    getOnboarding: new GetOnboardingUseCase(appConfigRepository),
    updateOnboarding: new UpdateOnboardingUseCase(appConfigRepository, eventPublisher),
    resetOnboarding: new ResetOnboardingUseCase(appConfigRepository, eventPublisher),
    getQuickCaptureShortcut: new GetQuickCaptureShortcutUseCase(
      appConfigRepository,
      globalShortcutRegistrar,
    ),
    setQuickCaptureShortcut: new SetQuickCaptureShortcutUseCase(
      appConfigRepository,
      globalShortcutRegistrar,
      eventPublisher,
    ),
  };
}
