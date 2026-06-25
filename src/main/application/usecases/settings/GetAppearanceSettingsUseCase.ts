import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { AppearanceSettings } from '../../../domain/value-objects/AppConfig';

async function getAppearanceSettings(repository: IAppConfigRepository): Promise<AppearanceSettings> {
  const config = await repository.get();
  return config.appearance;
}

export class GetAppearanceSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<AppearanceSettings> {
    return getAppearanceSettings(this.appConfigRepository);
  }
}
