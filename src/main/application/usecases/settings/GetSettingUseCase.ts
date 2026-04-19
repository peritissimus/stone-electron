import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
import type { IGetSettingUseCase } from '../../../domain/ports/in/ISettingsUseCases';

export class GetSettingUseCase implements IGetSettingUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(request: { key: string }): Promise<{ value: string | null }> {
    const setting = await this.settingsRepository.get(request.key);
    return { value: setting?.value ?? null };
  }
}
