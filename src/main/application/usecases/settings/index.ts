import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
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

export interface SettingsUseCasesDeps {
  settingsRepository: ISettingsRepository;
}

export function createSettingsUseCases(deps: SettingsUseCasesDeps): ISettingsUseCases {
  const { settingsRepository } = deps;

  return {
    get: new GetSettingUseCase(settingsRepository),
    set: new SetSettingUseCase(settingsRepository),
    getAll: new GetAllSettingsUseCase(settingsRepository),
    getAppearance: new GetAppearanceSettingsUseCase(settingsRepository),
    setTheme: new SetThemeUseCase(settingsRepository),
    setAccentColor: new SetAccentColorUseCase(settingsRepository),
    updateFontSettings: new UpdateFontSettingsUseCase(settingsRepository),
    resetFontSettings: new ResetFontSettingsUseCase(settingsRepository),
  };
}
