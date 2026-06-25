import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { AppTheme } from '../../../domain/value-objects/AppConfig';
import { publishAppearanceChanged } from './appearanceHelpers';

export class SetThemeUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { theme: AppTheme }): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: { ...config.appearance, theme: request.theme },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}
