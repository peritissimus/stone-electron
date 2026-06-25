import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { AppAccentColor } from '../../../domain/value-objects/AppConfig';
import { publishAppearanceChanged } from './appearanceHelpers';

export class SetAccentColorUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { accentColor: AppAccentColor }): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: { ...config.appearance, accentColor: request.accentColor },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}
