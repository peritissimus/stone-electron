import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { ShortcutsConfig } from '../../../domain/value-objects/AppConfig';
import { DEFAULT_APP_CONFIG } from '../../../domain/value-objects/AppConfig';
import { publishShortcutsChanged } from './shortcutsHelpers';

export class ResetAllShortcutsUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(): Promise<ShortcutsConfig> {
    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      shortcuts: DEFAULT_APP_CONFIG.shortcuts,
    }));
    publishShortcutsChanged(this.eventPublisher);
    return next.shortcuts;
  }
}
