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

export function publishShortcutsChanged(eventPublisher?: IEventPublisher): void {
  eventPublisher?.publish({
    type: 'settings:changed',
    timestamp: new Date(),
    payload: { scope: 'shortcuts' },
  });
}

export function assertKnownAction(scope: ShortcutsScope, action: string): void {
  const known = scope === 'app' ? KNOWN_APP_ACTIONS : KNOWN_EDITOR_ACTIONS;
  if (!known.has(action as never)) {
    throw new ShortcutConflictError({
      chord: '',
      conflictingActions: [action],
      reserved: false,
    });
  }
}

export function assertChordsValid(binding: ChordBinding | ChordBinding[]): void {
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

export function assertNotReserved(binding: ChordBinding | ChordBinding[]): void {
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

export function assertNoConflicts(
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

export function withBinding(
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

export function withoutBinding(
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
