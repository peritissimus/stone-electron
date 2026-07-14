import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { ShortcutsScope } from '../../../domain/ports/in/ISettingsUseCases';
import type { ShortcutsConfig } from '../../../domain/value-objects/AppConfig';
import {
  assertKnownAction,
  publishShortcutsChanged,
  withoutBinding,
} from './shortcutsHelpers';

export class ResetShortcutUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: { scope: ShortcutsScope; action: string }): Promise<ShortcutsConfig> {
    const { scope, action } = request;
    assertKnownAction(scope, action);

    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      shortcuts: withoutBinding(config.shortcuts, scope, action),
    }));
    publishShortcutsChanged(this.eventPublisher);
    return next.shortcuts;
  }
}
