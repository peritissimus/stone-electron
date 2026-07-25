import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IntegrationsConfig } from '../../../domain/value-objects/AppConfig';

export class GetIntegrationsSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<IntegrationsConfig> {
    const config = await this.appConfigRepository.get();
    return config.integrations;
  }
}
