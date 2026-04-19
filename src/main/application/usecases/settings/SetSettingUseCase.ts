import type { ISettingsRepository } from '../../../domain/ports/out/ISettingsRepository';
import type { ISetSettingUseCase } from '../../../domain/ports/in/ISettingsUseCases';

export class SetSettingUseCase implements ISetSettingUseCase {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async execute(request: { key: string; value: string }): Promise<void> {
    await this.settingsRepository.set(request.key, request.value);
  }
}
