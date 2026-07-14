import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { ShortcutsScope } from '../../../domain/ports/in/ISettingsUseCases';
import type { ChordBinding, ShortcutsConfig } from '../../../domain/value-objects/AppConfig';
import {
  assertChordsValid,
  assertKnownAction,
  assertNoConflicts,
  assertNotReserved,
  publishShortcutsChanged,
  withBinding,
} from './shortcutsHelpers';

export class SetShortcutUseCase {
  constructor(
    private readonly appConfigRepository: IAppConfigRepository,
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async execute(request: {
    scope: ShortcutsScope;
    action: string;
    binding: ChordBinding | ChordBinding[];
  }): Promise<ShortcutsConfig> {
    const { scope, action, binding } = request;

    assertKnownAction(scope, action);
    assertChordsValid(binding);
    assertNotReserved(binding);

    const current = await this.appConfigRepository.get();
    const candidate = withBinding(current.shortcuts, scope, action, binding);
    assertNoConflicts(scope, action, binding, candidate);

    const next = await this.appConfigRepository.update((config) => ({
      ...config,
      shortcuts: candidate,
    }));
    publishShortcutsChanged(this.eventPublisher);
    return next.shortcuts;
  }
}
