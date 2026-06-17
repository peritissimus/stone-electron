import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { IntegrationsConfig } from '../../../domain/value-objects/AppConfig';

function publishIntegrationsChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'integrations' },
  });
}

function mergeIntegrationsPatch(
  current: IntegrationsConfig,
  patch: Partial<IntegrationsConfig>,
): IntegrationsConfig {
  return {
    linearApiKey:
      patch.linearApiKey === undefined ? current.linearApiKey : patch.linearApiKey.trim(),
  };
}

export class GetIntegrationsSettingsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<IntegrationsConfig> {
    const config = await this.appConfigRepository.get();
    return config.integrations;
  }
}

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
