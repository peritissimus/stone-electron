/**
 * Pure shortcut utilities — chord parsing, validation, default resolution,
 * and conflict detection. No I/O, no React, no Electron — safe to import
 * from both main and renderer.
 *
 * Chord format mirrors TipTap/ProseMirror:
 *   "Mod-Shift-Enter", "Tab", "Mod-,", "Mod-Alt-Shift-Enter"
 *
 * Modifiers: Mod, Cmd, Ctrl, Alt, Option, Shift, Meta
 * Mod is the platform modifier (Cmd on macOS, Ctrl elsewhere).
 *
 * Keys: single character, "Tab", "Enter", "Backspace", "Delete", "Space",
 *       "ArrowUp"/"ArrowDown"/"ArrowLeft"/"ArrowRight", "Escape", "Home",
 *       "End", "PageUp"/"PageDown", "F1".."F24", or any single printable char.
 */

import {
  DEFAULT_APP_SHORTCUTS,
  DEFAULT_EDITOR_SHORTCUTS,
  RESERVED_CHORDS,
} from '../constants/defaultShortcuts';
import type {
  AppShortcutAction,
  ChordBinding,
  EditorShortcutAction,
  ShortcutsConfig,
} from '../types/settings';

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

export interface ParsedChord {
  modifiers: string[]; // canonical order: Mod, Ctrl, Cmd, Meta, Alt, Shift
  key: string;
}

/**
 * Parse a chord string. Returns null if syntactically invalid.
 *
 * Canonicalizes modifier order so equivalent chords compare equal:
 *   "Shift-Mod-s"  →  { modifiers: ["Mod", "Shift"], key: "s" }
 *   "Mod-Shift-s"  →  { modifiers: ["Mod", "Shift"], key: "s" }
 */
export function parseChord(chord: string): ParsedChord | null {
  if (typeof chord !== 'string' || chord.length === 0) {
    return null;
  }

  const parts = chord.split('-');
  if (parts.length === 0) {
    return null;
  }

  // Last segment is the key; everything before must be a modifier.
  const key = parts[parts.length - 1];
  const rawModifiers = parts.slice(0, -1);

  if (key.length === 0) {
    return null;
  }

  if (!isValidKey(key)) {
    return null;
  }

  const seen = new Set<string>();
  for (const mod of rawModifiers) {
    if (!KNOWN_MODIFIERS.has(mod)) {
      return null;
    }
    if (seen.has(mod)) {
      return null; // duplicate modifier
    }
    seen.add(mod);
  }

  return {
    modifiers: canonicalizeModifiers(rawModifiers),
    key,
  };
}

/**
 * True iff the chord parses cleanly. Use this at IPC/repository boundaries.
 */
export function validateChord(chord: string): boolean {
  return parseChord(chord) !== null;
}

/**
 * True iff the chord collides with a built-in TipTap StarterKit /
 * ProseMirror binding the user shouldn't be allowed to silently shadow.
 *
 * Comparison is done after canonicalization so "Shift-Mod-z" matches
 * "Mod-Shift-z".
 */
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

/**
 * Format a parsed chord back to canonical string form.
 */
export function formatChord(parsed: ParsedChord): string {
  return [...parsed.modifiers, parsed.key].join('-');
}

/**
 * Canonicalize a chord string. Returns null if the input is invalid.
 *
 * "Shift-Mod-s" → "Mod-Shift-s"
 */
export function canonicalizeChord(chord: string): string | null {
  const parsed = parseChord(chord);
  return parsed ? formatChord(parsed) : null;
}

/**
 * Resolved binding for a single action — always one or more chords,
 * derived from defaults + user override.
 */
export interface ResolvedBinding<TAction extends string> {
  action: TAction;
  scope: 'app' | 'editor';
  chords: string[]; // canonicalized
  isCustomized: boolean;
}

export interface ResolvedShortcuts {
  app: Record<AppShortcutAction, ResolvedBinding<AppShortcutAction>>;
  editor: Record<EditorShortcutAction, ResolvedBinding<EditorShortcutAction>>;
}

/**
 * Apply sparse user overrides on top of defaults. Invalid override chords
 * are silently dropped (the persistence layer is expected to have rejected
 * them earlier; this is a safety net).
 */
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

/**
 * Find chord collisions across the resolved set.
 *
 * Returns one entry per chord that's bound to more than one action. Note that
 * some collisions are intentional (Tab → indent + tableNextCell): callers
 * decide whether to surface as warnings or hard errors.
 */
export interface ShortcutConflict {
  chord: string; // canonical form
  bindings: Array<{ scope: 'app' | 'editor'; action: string }>;
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

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function isValidKey(key: string): boolean {
  if (NAMED_KEYS.has(key)) return true;
  if (FUNCTION_KEY_PATTERN.test(key)) return true;
  // Single printable character (letter, digit, punctuation).
  if (key.length === 1 && key.charCodeAt(0) >= 0x20 && key.charCodeAt(0) <= 0x7e) {
    return true;
  }
  return false;
}

const MODIFIER_ORDER: readonly string[] = ['Mod', 'Ctrl', 'Cmd', 'Meta', 'Alt', 'Option', 'Shift'];

function canonicalizeModifiers(mods: readonly string[]): string[] {
  const set = new Set(mods);
  return MODIFIER_ORDER.filter((m) => set.has(m));
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
  const valid: string[] = [];
  for (const chord of raw) {
    const canonical = canonicalizeChord(chord);
    if (canonical !== null) {
      valid.push(canonical);
    }
  }

  if (valid.length === 0) {
    // Override was entirely garbage; fall back to default rather than unbinding.
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
