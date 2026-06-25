import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';
import { publishAppearanceChanged } from './appearanceHelpers';

export class ResetFontSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: {
        ...config.appearance,
        fontSettings: DEFAULT_APP_CONFIG.appearance.fontSettings,
      },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}
