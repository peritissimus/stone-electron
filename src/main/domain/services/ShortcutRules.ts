import {
  DEFAULT_APP_SHORTCUTS,
  DEFAULT_EDITOR_SHORTCUTS,
  RESERVED_CHORDS,
  type AppShortcutAction,
  type ChordBinding,
  type EditorShortcutAction,
  type ShortcutsConfig,
} from '../value-objects/AppConfig';

const KNOWN_MODIFIERS = new Set(['Mod', 'Cmd', 'Ctrl', 'Alt', 'Option', 'Shift', 'Meta']);

const NAMED_KEYS = new Set([
  'Tab',
  'Enter',
  'Backspace',
  'Delete',
  'Space',
  'Escape',
  'Esc',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const FUNCTION_KEY_PATTERN = /^F([1-9]|1\d|2[0-4])$/;
const MODIFIER_ORDER: readonly string[] = ['Mod', 'Ctrl', 'Cmd', 'Meta', 'Alt', 'Option', 'Shift'];

export interface ParsedChord {
  modifiers: string[];
  key: string;
}

export interface ResolvedBinding<TAction extends string> {
  action: TAction;
  scope: 'app' | 'editor';
  chords: string[];
  isCustomized: boolean;
}

export interface ResolvedShortcuts {
  app: Record<AppShortcutAction, ResolvedBinding<AppShortcutAction>>;
  editor: Record<EditorShortcutAction, ResolvedBinding<EditorShortcutAction>>;
}

export interface ShortcutConflict {
  chord: string;
  bindings: Array<{ scope: 'app' | 'editor'; action: string }>;
}

export function parseChord(chord: string): ParsedChord | null {
  if (typeof chord !== 'string' || chord.length === 0) {
    return null;
  }

  const parts = chord.split('-');
  const key = parts[parts.length - 1];
  const rawModifiers = parts.slice(0, -1);

  if (!key || !isValidKey(key)) {
    return null;
  }

  const seen = new Set<string>();
  for (const mod of rawModifiers) {
    if (!KNOWN_MODIFIERS.has(mod) || seen.has(mod)) {
      return null;
    }
    seen.add(mod);
  }

  return {
    modifiers: canonicalizeModifiers(rawModifiers),
    key,
  };
}

export function validateChord(chord: string): boolean {
  return parseChord(chord) !== null;
}

export function isReservedChord(chord: string): boolean {
  const parsed = parseChord(chord);
  if (!parsed) {
    return false;
  }

  const canonical = formatChord(parsed);
  for (const reserved of RESERVED_CHORDS) {
    const reservedParsed = parseChord(reserved);
    if (reservedParsed && formatChord(reservedParsed) === canonical) {
      return true;
    }
  }
  return false;
}

export function formatChord(parsed: ParsedChord): string {
  return [...parsed.modifiers, parsed.key].join('-');
}

export function canonicalizeChord(chord: string): string | null {
  const parsed = parseChord(chord);
  return parsed ? formatChord(parsed) : null;
}

export function resolveShortcuts(overrides: ShortcutsConfig): ResolvedShortcuts {
  const app = {} as Record<AppShortcutAction, ResolvedBinding<AppShortcutAction>>;
  for (const action of Object.keys(DEFAULT_APP_SHORTCUTS) as AppShortcutAction[]) {
    app[action] = resolveOne(action, 'app', DEFAULT_APP_SHORTCUTS[action], overrides.app[action]);
  }

  const editor = {} as Record<EditorShortcutAction, ResolvedBinding<EditorShortcutAction>>;
  for (const action of Object.keys(DEFAULT_EDITOR_SHORTCUTS) as EditorShortcutAction[]) {
    editor[action] = resolveOne(
      action,
      'editor',
      DEFAULT_EDITOR_SHORTCUTS[action],
      overrides.editor[action],
    );
  }

  return { app, editor };
}

export function detectConflicts(resolved: ResolvedShortcuts): ShortcutConflict[] {
  const byChord = new Map<string, Array<{ scope: 'app' | 'editor'; action: string }>>();

  const collect = (binding: ResolvedBinding<string>) => {
    for (const chord of binding.chords) {
      const list = byChord.get(chord) ?? [];
      list.push({ scope: binding.scope, action: binding.action });
      byChord.set(chord, list);
    }
  };

  for (const binding of Object.values(resolved.app)) {
    collect(binding);
  }
  for (const binding of Object.values(resolved.editor)) {
    collect(binding);
  }

  const conflicts: ShortcutConflict[] = [];
  for (const [chord, bindings] of byChord.entries()) {
    if (bindings.length > 1) {
      conflicts.push({ chord, bindings });
    }
  }
  return conflicts;
}

function isValidKey(key: string): boolean {
  if (NAMED_KEYS.has(key)) return true;
  if (FUNCTION_KEY_PATTERN.test(key)) return true;
  return key.length === 1 && key.charCodeAt(0) >= 0x20 && key.charCodeAt(0) <= 0x7e;
}

function canonicalizeModifiers(mods: readonly string[]): string[] {
  const set = new Set(mods);
  return MODIFIER_ORDER.filter((modifier) => set.has(modifier));
}

function resolveOne<TAction extends string>(
  action: TAction,
  scope: 'app' | 'editor',
  defaultChord: ChordBinding,
  override: ChordBinding | ChordBinding[] | undefined,
): ResolvedBinding<TAction> {
  if (override === undefined) {
    const canonical = canonicalizeChord(defaultChord);
    return {
      action,
      scope,
      chords: canonical ? [canonical] : [],
      isCustomized: false,
    };
  }

  const raw = Array.isArray(override) ? override : [override];
  const valid = raw
    .map(canonicalizeChord)
    .filter((chord): chord is string => chord !== null);

  if (valid.length === 0) {
    const canonical = canonicalizeChord(defaultChord);
    return {
      action,
      scope,
      chords: canonical ? [canonical] : [],
      isCustomized: false,
    };
  }

  return {
    action,
    scope,
    chords: valid,
    isCustomized: true,
  };
}
