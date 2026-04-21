/**
 * Unit tests for shared shortcut utilities.
 * Pure functions, no setup required.
 */

import { describe, it, expect } from 'vitest';
import {
  parseChord,
  validateChord,
  canonicalizeChord,
  formatChord,
  isReservedChord,
  resolveShortcuts,
  detectConflicts,
} from '../../../src/shared/utils/shortcuts';
import {
  DEFAULT_APP_SHORTCUTS,
  DEFAULT_EDITOR_SHORTCUTS,
} from '../../../src/shared/constants/defaultShortcuts';
import { DEFAULT_SHORTCUTS_CONFIG } from '../../../src/shared/types/settings';

describe('parseChord', () => {
  it('parses single key', () => {
    expect(parseChord('Tab')).toEqual({ modifiers: [], key: 'Tab' });
    expect(parseChord('s')).toEqual({ modifiers: [], key: 's' });
    expect(parseChord(',')).toEqual({ modifiers: [], key: ',' });
  });

  it('parses single modifier + key', () => {
    expect(parseChord('Mod-s')).toEqual({ modifiers: ['Mod'], key: 's' });
    expect(parseChord('Shift-Tab')).toEqual({ modifiers: ['Shift'], key: 'Tab' });
  });

  it('parses multiple modifiers', () => {
    expect(parseChord('Mod-Shift-Enter')).toEqual({
      modifiers: ['Mod', 'Shift'],
      key: 'Enter',
    });
    expect(parseChord('Mod-Alt-Shift-Enter')).toEqual({
      modifiers: ['Mod', 'Alt', 'Shift'],
      key: 'Enter',
    });
  });

  it('canonicalizes modifier order', () => {
    expect(parseChord('Shift-Mod-s')).toEqual({ modifiers: ['Mod', 'Shift'], key: 's' });
    expect(parseChord('Alt-Shift-Mod-Enter')).toEqual({
      modifiers: ['Mod', 'Alt', 'Shift'],
      key: 'Enter',
    });
  });

  it('parses function keys', () => {
    expect(parseChord('F1')).toEqual({ modifiers: [], key: 'F1' });
    expect(parseChord('Mod-F12')).toEqual({ modifiers: ['Mod'], key: 'F12' });
    expect(parseChord('F24')).toEqual({ modifiers: [], key: 'F24' });
  });

  it('parses arrow keys', () => {
    expect(parseChord('ArrowUp')).toEqual({ modifiers: [], key: 'ArrowUp' });
    expect(parseChord('Mod-ArrowLeft')).toEqual({ modifiers: ['Mod'], key: 'ArrowLeft' });
  });

  it('rejects empty input', () => {
    expect(parseChord('')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(parseChord(null as unknown as string)).toBeNull();
    expect(parseChord(undefined as unknown as string)).toBeNull();
    expect(parseChord(123 as unknown as string)).toBeNull();
  });

  it('rejects unknown modifier', () => {
    expect(parseChord('Hyper-s')).toBeNull();
    expect(parseChord('Super-Mod-s')).toBeNull();
  });

  it('rejects duplicate modifier', () => {
    expect(parseChord('Mod-Mod-s')).toBeNull();
    expect(parseChord('Shift-Mod-Shift-s')).toBeNull();
  });

  it('rejects empty key segment', () => {
    expect(parseChord('Mod-')).toBeNull();
  });

  it('rejects unknown named key', () => {
    expect(parseChord('Mod-NotAKey')).toBeNull();
    expect(parseChord('Mod-F25')).toBeNull(); // function key out of range
    expect(parseChord('F0')).toBeNull();
  });

  it('rejects multi-character non-named key', () => {
    expect(parseChord('Mod-ab')).toBeNull();
  });
});

describe('validateChord', () => {
  it('returns true for valid chords', () => {
    expect(validateChord('Mod-s')).toBe(true);
    expect(validateChord('Tab')).toBe(true);
  });

  it('returns false for invalid chords', () => {
    expect(validateChord('')).toBe(false);
    expect(validateChord('Mod-')).toBe(false);
    expect(validateChord('Hyper-s')).toBe(false);
  });
});

describe('canonicalizeChord', () => {
  it('returns canonical string', () => {
    expect(canonicalizeChord('Shift-Mod-s')).toBe('Mod-Shift-s');
  });

  it('returns null for invalid input', () => {
    expect(canonicalizeChord('garbage')).toBeNull();
  });

  it('is idempotent', () => {
    const first = canonicalizeChord('Shift-Mod-Alt-Enter');
    expect(first).not.toBeNull();
    expect(canonicalizeChord(first!)).toBe(first);
  });
});

describe('formatChord', () => {
  it('joins modifiers and key with dash', () => {
    expect(formatChord({ modifiers: ['Mod', 'Shift'], key: 'Enter' })).toBe('Mod-Shift-Enter');
    expect(formatChord({ modifiers: [], key: 'Tab' })).toBe('Tab');
  });
});

describe('isReservedChord', () => {
  it('flags StarterKit defaults', () => {
    expect(isReservedChord('Mod-b')).toBe(true);
    expect(isReservedChord('Mod-z')).toBe(true);
    expect(isReservedChord('Mod-Shift-z')).toBe(true);
  });

  it('matches after canonicalization', () => {
    expect(isReservedChord('Shift-Mod-z')).toBe(true);
  });

  it('does NOT flag chords claimed by Stone editor extensions', () => {
    // Mod-Enter is the default for tableExit; users may keep or rebind to it.
    expect(isReservedChord('Mod-Enter')).toBe(false);
  });

  it('does NOT flag invalid input', () => {
    expect(isReservedChord('garbage')).toBe(false);
  });

  it('does NOT flag arbitrary user chords', () => {
    expect(isReservedChord('Mod-Shift-Alt-q')).toBe(false);
  });
});

describe('resolveShortcuts', () => {
  it('returns defaults when overrides empty', () => {
    const resolved = resolveShortcuts(DEFAULT_SHORTCUTS_CONFIG);

    expect(resolved.app.save.chords).toEqual(['Mod-s']);
    expect(resolved.app.save.isCustomized).toBe(false);
    expect(resolved.editor.indent.chords).toEqual(['Tab']);
    expect(resolved.editor.taskCycleForward.chords).toEqual(['Mod-Shift-Enter']);
  });

  it('applies single-chord override', () => {
    const resolved = resolveShortcuts({
      app: { save: 'Mod-Alt-s' },
      editor: {},
    });

    expect(resolved.app.save.chords).toEqual(['Mod-Alt-s']);
    expect(resolved.app.save.isCustomized).toBe(true);
    expect(resolved.app.newNote.chords).toEqual(['Mod-n']);
    expect(resolved.app.newNote.isCustomized).toBe(false);
  });

  it('applies multi-chord override', () => {
    const resolved = resolveShortcuts({
      app: { save: ['Mod-s', 'Mod-Alt-s'] },
      editor: {},
    });

    expect(resolved.app.save.chords).toEqual(['Mod-s', 'Mod-Alt-s']);
    expect(resolved.app.save.isCustomized).toBe(true);
  });

  it('canonicalizes override chords', () => {
    const resolved = resolveShortcuts({
      app: { save: 'Shift-Mod-s' },
      editor: {},
    });

    expect(resolved.app.save.chords).toEqual(['Mod-Shift-s']);
  });

  it('drops invalid chords from a multi-chord override', () => {
    const resolved = resolveShortcuts({
      app: { save: ['Mod-s', 'garbage', 'Mod-Alt-s'] },
      editor: {},
    });

    expect(resolved.app.save.chords).toEqual(['Mod-s', 'Mod-Alt-s']);
    expect(resolved.app.save.isCustomized).toBe(true);
  });

  it('falls back to default when override is entirely invalid', () => {
    const resolved = resolveShortcuts({
      app: { save: 'Hyper-garbage' },
      editor: {},
    });

    expect(resolved.app.save.chords).toEqual(['Mod-s']);
    expect(resolved.app.save.isCustomized).toBe(false);
  });

  it('produces a binding for every default action', () => {
    const resolved = resolveShortcuts(DEFAULT_SHORTCUTS_CONFIG);

    for (const action of Object.keys(DEFAULT_APP_SHORTCUTS)) {
      expect(resolved.app[action as keyof typeof resolved.app]).toBeDefined();
    }
    for (const action of Object.keys(DEFAULT_EDITOR_SHORTCUTS)) {
      expect(resolved.editor[action as keyof typeof resolved.editor]).toBeDefined();
    }
  });
});

describe('detectConflicts', () => {
  it('flags Tab as a conflict because it has multiple default bindings', () => {
    const resolved = resolveShortcuts(DEFAULT_SHORTCUTS_CONFIG);
    const conflicts = detectConflicts(resolved);

    const tabConflict = conflicts.find((c) => c.chord === 'Tab');
    expect(tabConflict).toBeDefined();
    expect(tabConflict!.bindings.map((b) => b.action).sort()).toEqual(
      ['indent', 'tableNextCell'].sort(),
    );
  });

  it('flags Shift-Tab as a conflict (outdent + tablePrevCell)', () => {
    const resolved = resolveShortcuts(DEFAULT_SHORTCUTS_CONFIG);
    const conflicts = detectConflicts(resolved);

    const shiftTab = conflicts.find((c) => c.chord === 'Shift-Tab');
    expect(shiftTab).toBeDefined();
    expect(shiftTab!.bindings.map((b) => b.action).sort()).toEqual(
      ['outdent', 'tablePrevCell'].sort(),
    );
  });

  it('does not flag chords bound to a single action', () => {
    const resolved = resolveShortcuts(DEFAULT_SHORTCUTS_CONFIG);
    const conflicts = detectConflicts(resolved);

    const saveConflict = conflicts.find((c) => c.chord === 'Mod-s');
    expect(saveConflict).toBeUndefined();
  });

  it('detects conflicts created by user override', () => {
    const resolved = resolveShortcuts({
      app: { save: 'Mod-k' }, // collides with commandCenter
      editor: {},
    });
    const conflicts = detectConflicts(resolved);

    const modK = conflicts.find((c) => c.chord === 'Mod-k');
    expect(modK).toBeDefined();
    expect(modK!.bindings.map((b) => b.action).sort()).toEqual(
      ['commandCenter', 'save'].sort(),
    );
  });

  it('treats canonically-equivalent chords as the same conflict', () => {
    const resolved = resolveShortcuts({
      app: { save: 'Shift-Mod-k' },
      editor: { indent: 'Mod-Shift-k' },
    });
    const conflicts = detectConflicts(resolved);

    const c = conflicts.find((c) => c.chord === 'Mod-Shift-k');
    expect(c).toBeDefined();
    expect(c!.bindings.length).toBe(2);
  });
});

describe('DEFAULT_SHORTCUTS_CONFIG', () => {
  it('is empty (sparse override model)', () => {
    expect(Object.keys(DEFAULT_SHORTCUTS_CONFIG.app).length).toBe(0);
    expect(Object.keys(DEFAULT_SHORTCUTS_CONFIG.editor).length).toBe(0);
  });
});

describe('default chord coverage', () => {
  it('every default app shortcut chord parses', () => {
    for (const [action, chord] of Object.entries(DEFAULT_APP_SHORTCUTS)) {
      expect(parseChord(chord), `${action} chord '${chord}' should parse`).not.toBeNull();
    }
  });

  it('every default editor shortcut chord parses', () => {
    for (const [action, chord] of Object.entries(DEFAULT_EDITOR_SHORTCUTS)) {
      expect(parseChord(chord), `${action} chord '${chord}' should parse`).not.toBeNull();
    }
  });

  it('no default app shortcut collides with a reserved StarterKit chord', () => {
    for (const [action, chord] of Object.entries(DEFAULT_APP_SHORTCUTS)) {
      expect(
        isReservedChord(chord),
        `${action} default '${chord}' must not be in RESERVED_CHORDS`,
      ).toBe(false);
    }
  });
});
