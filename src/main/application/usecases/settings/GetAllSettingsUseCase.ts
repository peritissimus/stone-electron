import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
import type {
  IGetAllSettingsUseCase,
  SettingDTO,
} from '../../../domain/ports/in/ISettingsUseCases';

export class GetAllSettingsUseCase implements IGetAllSettingsUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(): Promise<{ settings: SettingDTO[] }> {
    const allSettings = await this.settingsRepository.getAll();
    const settings: SettingDTO[] = allSettings.map((s) => ({
      key: s.key,
      value: s.value,
      updatedAt: s.updatedAt.getTime(),
    }));
    return { settings };
  }
}
