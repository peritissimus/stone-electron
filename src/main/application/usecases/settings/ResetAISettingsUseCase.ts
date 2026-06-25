import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { AIConfig } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';
import { publishAIChanged } from './aiHelpers';

export class ResetAISettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<AIConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      ai: DEFAULT_APP_CONFIG.ai,
    }));
    publishAIChanged(this.eventPublisher);
    return next.ai;
  }
}
