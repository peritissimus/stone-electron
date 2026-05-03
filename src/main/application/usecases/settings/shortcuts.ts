import type { IAppConfigRepository } from '../../../domain/ports/out/IAppConfigRepository';
import type { IEventPublisher } from '../../../domain/ports/out/IEventPublisher';
import type { ShortcutsScope } from '../../../domain/ports/in/ISettingsUseCases';
import { ShortcutConflictError } from '../../../domain/errors';
import type {
  AppShortcutAction,
  ChordBinding,
  EditorShortcutAction,
  ShortcutsConfig,
} from '../../../domain/value-objects/AppConfig';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_APP_SHORTCUTS,
  DEFAULT_EDITOR_SHORTCUTS,
} from '../../../domain/value-objects/AppConfig';
import {
  canonicalizeChord,
  detectConflicts,
  isReservedChord,
  resolveShortcuts,
  validateChord,
} from '../../../domain/services';

const KNOWN_APP_ACTIONS = new Set(Object.keys(DEFAULT_APP_SHORTCUTS) as AppShortcutAction[]);
const KNOWN_EDITOR_ACTIONS = new Set(
  Object.keys(DEFAULT_EDITOR_SHORTCUTS) as EditorShortcutAction[],
);

function publishShortcutsChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'shortcuts' },
  });
}

function assertKnownAction(scope: ShortcutsScope, action: string): void {
  const known = scope === 'app' ? KNOWN_APP_ACTIONS : KNOWN_EDITOR_ACTIONS;
  if (!known.has(action as never)) {
    throw new ShortcutConflictError({
      chord: '',
      conflictingActions: [action],
      reserved: false,
    });
  }
}

function assertChordsValid(binding: ChordBinding | ChordBinding[]): void {
  const chords = Array.isArray(binding) ? binding : [binding];
  for (const chord of chords) {
    if (!validateChord(chord)) {
      throw new ShortcutConflictError({
        chord,
        conflictingActions: [],
        reserved: false,
      });
    }
  }
}

function assertNotReserved(binding: ChordBinding | ChordBinding[]): void {
  const chords = Array.isArray(binding) ? binding : [binding];
  for (const chord of chords) {
    if (isReservedChord(chord)) {
      throw new ShortcutConflictError({
        chord,
        conflictingActions: [],
        reserved: true,
      });
    }
  }
}

function assertNoConflicts(
  scope: ShortcutsScope,
  action: string,
  binding: ChordBinding | ChordBinding[],
  next: ShortcutsConfig,
): void {
  // Resolve the candidate config and look for any chord on this action that
  // also appears on a *different* action.
  const resolved = resolveShortcuts(next);
  const conflicts = detectConflicts(resolved);
  const candidateChords = new Set(
    (Array.isArray(binding) ? binding : [binding])
      .map(canonicalizeChord)
      .filter((c): c is string => c !== null),
  );

  for (const conflict of conflicts) {
    if (!candidateChords.has(conflict.chord)) continue;
    const otherActions = conflict.bindings
      .filter((b) => !(b.scope === scope && b.action === action))
      .map((b) => `${b.scope}:${b.action}`);
    if (otherActions.length > 0) {
      throw new ShortcutConflictError({
        chord: conflict.chord,
        conflictingActions: otherActions,
        reserved: false,
      });
    }
  }
}

function withBinding(
  current: ShortcutsConfig,
  scope: ShortcutsScope,
  action: string,
  binding: ChordBinding | ChordBinding[],
): ShortcutsConfig {
  if (scope === 'app') {
    return {
      ...current,
      app: { ...current.app, [action as AppShortcutAction]: binding },
    };
  }
  return {
    ...current,
    editor: { ...current.editor, [action as EditorShortcutAction]: binding },
  };
}

function withoutBinding(
  current: ShortcutsConfig,
  scope: ShortcutsScope,
  action: string,
): ShortcutsConfig {
  if (scope === 'app') {
    const { [action as AppShortcutAction]: _removed, ...rest } = current.app;
    void _removed;
    return { ...current, app: rest };
  }
  const { [action as EditorShortcutAction]: _removed, ...rest } = current.editor;
  void _removed;
  return { ...current, editor: rest };
}

export class GetShortcutsUseCase {
  constructor(private readonly appConfigRepository: IAppConfigRepository) {}

  async execute(): Promise<ShortcutsConfig> {
    const config = await this.appConfigRepository.get();
    return config.shortcuts;
  }
}

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
