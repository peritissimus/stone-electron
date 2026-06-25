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
import { GetAppearanceSettingsUseCase } from './GetAppearanceSettingsUseCase';
import { SetThemeUseCase } from './SetThemeUseCase';
import { SetAccentColorUseCase } from './SetAccentColorUseCase';
import { UpdateFontSettingsUseCase } from './UpdateFontSettingsUseCase';
import { ResetFontSettingsUseCase } from './ResetFontSettingsUseCase';
import { GetEditorSettingsUseCase } from './GetEditorSettingsUseCase';
import { UpdateEditorSettingsUseCase } from './UpdateEditorSettingsUseCase';
import { ResetEditorSettingsUseCase } from './ResetEditorSettingsUseCase';
import { GetShortcutsUseCase } from './GetShortcutsUseCase';
import { SetShortcutUseCase } from './SetShortcutUseCase';
import { ResetShortcutUseCase } from './ResetShortcutUseCase';
import { ResetAllShortcutsUseCase } from './ResetAllShortcutsUseCase';
import { GetAISettingsUseCase } from './GetAISettingsUseCase';
import { UpdateAISettingsUseCase } from './UpdateAISettingsUseCase';
import { ResetAISettingsUseCase } from './ResetAISettingsUseCase';
import { GetAIProviderKeysUseCase } from './GetAIProviderKeysUseCase';
import { SetAIProviderKeyUseCase } from './SetAIProviderKeyUseCase';
import { DeleteAIProviderKeyUseCase } from './DeleteAIProviderKeyUseCase';
import { GetMeetingsSettingsUseCase } from './GetMeetingsSettingsUseCase';
import { UpdateMeetingsSettingsUseCase } from './UpdateMeetingsSettingsUseCase';
import { ResetMeetingsSettingsUseCase } from './ResetMeetingsSettingsUseCase';
import { GetOnboardingUseCase } from './GetOnboardingUseCase';
import { UpdateOnboardingUseCase } from './UpdateOnboardingUseCase';
import { ResetOnboardingUseCase } from './ResetOnboardingUseCase';
import { GetQuickCaptureShortcutUseCase } from './GetQuickCaptureShortcutUseCase';
import { SetQuickCaptureShortcutUseCase } from './SetQuickCaptureShortcutUseCase';

export { GetSettingUseCase } from './GetSettingUseCase';
export { SetSettingUseCase } from './SetSettingUseCase';
export { GetAllSettingsUseCase } from './GetAllSettingsUseCase';
export { GetAppearanceSettingsUseCase } from './GetAppearanceSettingsUseCase';
export { SetThemeUseCase } from './SetThemeUseCase';
export { SetAccentColorUseCase } from './SetAccentColorUseCase';
export { UpdateFontSettingsUseCase } from './UpdateFontSettingsUseCase';
export { ResetFontSettingsUseCase } from './ResetFontSettingsUseCase';
export { GetEditorSettingsUseCase } from './GetEditorSettingsUseCase';
export { UpdateEditorSettingsUseCase } from './UpdateEditorSettingsUseCase';
export { ResetEditorSettingsUseCase } from './ResetEditorSettingsUseCase';
export { GetShortcutsUseCase } from './GetShortcutsUseCase';
export { SetShortcutUseCase } from './SetShortcutUseCase';
export { ResetShortcutUseCase } from './ResetShortcutUseCase';
export { ResetAllShortcutsUseCase } from './ResetAllShortcutsUseCase';
export { GetAISettingsUseCase } from './GetAISettingsUseCase';
export { UpdateAISettingsUseCase } from './UpdateAISettingsUseCase';
export { ResetAISettingsUseCase } from './ResetAISettingsUseCase';
export { GetAIProviderKeysUseCase } from './GetAIProviderKeysUseCase';
export { SetAIProviderKeyUseCase } from './SetAIProviderKeyUseCase';
export { DeleteAIProviderKeyUseCase } from './DeleteAIProviderKeyUseCase';
export { GetMeetingsSettingsUseCase } from './GetMeetingsSettingsUseCase';
export { UpdateMeetingsSettingsUseCase } from './UpdateMeetingsSettingsUseCase';
export { ResetMeetingsSettingsUseCase } from './ResetMeetingsSettingsUseCase';
export { GetOnboardingUseCase } from './GetOnboardingUseCase';
export { UpdateOnboardingUseCase } from './UpdateOnboardingUseCase';
export { ResetOnboardingUseCase } from './ResetOnboardingUseCase';
export { type OnboardingPatch } from './onboardingHelpers';
export { GetQuickCaptureShortcutUseCase } from './GetQuickCaptureShortcutUseCase';
export { SetQuickCaptureShortcutUseCase } from './SetQuickCaptureShortcutUseCase';

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
