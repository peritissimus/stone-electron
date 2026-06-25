import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { FontSettings } from '../../../domain/value-objects/AppConfig';
import { publishAppearanceChanged } from './appearanceHelpers';

export class UpdateFontSettingsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { fontSettings: Partial<FontSettings> }): Promise<void> {
    await this.appConfigRepository.update((config) => ({
      ...config,
      appearance: {
        ...config.appearance,
        fontSettings: { ...config.appearance.fontSettings, ...request.fontSettings },
      },
    }));
    publishAppearanceChanged(this.eventPublisher);
  }
}
