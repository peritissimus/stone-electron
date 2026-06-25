import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { AIConfig } from '../../../domain/value-objects/AppConfig';

export class GetAISettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<AIConfig> {
    const config = await this.appConfigRepository.get();
    return config.ai;
  }
}
