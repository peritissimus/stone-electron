import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { AIConfig } from '../../../domain/value-objects/AppConfig';
import { mergeAIPatch, publishAIChanged } from './aiHelpers';

export class UpdateAISettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { ai: Partial<AIConfig> }): Promise<AIConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      ai: mergeAIPatch(config.ai, request.ai),
    }));
    publishAIChanged(this.eventPublisher);
    return next.ai;
  }
}
