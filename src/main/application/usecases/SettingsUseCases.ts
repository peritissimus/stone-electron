/**
 * Settings Use Cases - Key-value settings management
 */

import type { ISettingsRepository } from '../../domain/ports/out/ISettingsRepository';
import type { ISettingsUseCases, SettingDTO } from '../../domain/ports/in/ISettingsUseCases';
import { logger } from '../../shared/utils';

export interface SettingsUseCasesDeps {
  settingsRepository: ISettingsRepository;
}

class SettingsUseCasesImpl implements ISettingsUseCases {
  constructor(private deps: SettingsUseCasesDeps) {}

  async get(key: string): Promise<{ value: string | null }> {
    logger.debug(`[SettingsUseCases] Getting setting: ${key}`);
    const setting = await this.deps.settingsRepository.get(key);
    return { value: setting?.value ?? null };
  }

  async set(key: string, value: string): Promise<void> {
    logger.debug(`[SettingsUseCases] Setting ${key} = ${value}`);
    await this.deps.settingsRepository.set(key, value);
  }

  async getAll(): Promise<{ settings: SettingDTO[] }> {
    logger.debug('[SettingsUseCases] Getting all settings');
    const allSettings = await this.deps.settingsRepository.getAll();

    const settings: SettingDTO[] = allSettings.map((s) => ({
      key: s.key,
      value: s.value,
      updatedAt: s.updatedAt.getTime(),
    }));

    return { settings };
  }
}

export function createSettingsUseCases(deps: SettingsUseCasesDeps): ISettingsUseCases {
  return new SettingsUseCasesImpl(deps);
}
