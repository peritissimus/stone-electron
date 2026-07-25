import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IntegrationsConfig } from '../../../domain/value-objects/AppConfig';
import { mergeIntegrationsPatch, publishIntegrationsChanged } from './integrationsHelpers';

export class UpdateIntegrationsSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    integrations: Partial<IntegrationsConfig>;
  }): Promise<IntegrationsConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      integrations: mergeIntegrationsPatch(config.integrations, request.integrations),
    }));
    publishIntegrationsChanged(this.eventPublisher);
    return next.integrations;
  }
}
