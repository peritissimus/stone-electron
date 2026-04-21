/**
 * Self-healing AppConfig normalization.
 *
 * Pure functions: given an arbitrary parsed JSON value (or undefined),
 * return a fully-typed AppConfig with defaults filled in for any missing
 * or invalid fields. Never throws; instead degrades gracefully so a
 * partially-corrupt config.json keeps the app usable.
 *
 * Self-healing strategy mirrors mergeAppearance's existing approach:
 *   - non-object → return defaults entirely
 *   - object → walk each known field, validate type, fall back to default
 *   - unknown keys are dropped (not preserved)
 *
 * No I/O. Safe to test as a pure module.
 */

import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type AppAccentColor,
  type AppearanceSettings,
  type AppShortcutAction,
  type AppTheme,
  type ChordBinding,
  type EditorBehaviorConfig,
  type EditorCodeBlockConfig,
  type EditorIndentConfig,
  type EditorShortcutAction,
  type EditorSettings,
  type EditorTableConfig,
  type EditorTaskConfig,
  type EditorTaskStateDef,
  type FontSettings,
  type ShortcutsConfig,
} from '@shared/types/settings';
import {
  DEFAULT_APP_SHORTCUTS,
  DEFAULT_EDITOR_SHORTCUTS,
} from '@shared/constants/defaultShortcuts';
import { validateChord } from '@shared/utils/shortcuts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

// ---------- appearance ----------

function isTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isAccentColor(value: unknown): value is AppAccentColor {
  return (
    value === 'blue' ||
    value === 'purple' ||
    value === 'pink' ||
    value === 'red' ||
    value === 'orange' ||
    value === 'green' ||
    value === 'teal'
  );
}

function mergeFontSettings(value: unknown): FontSettings {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.appearance.fontSettings;
  }
  return {
    ...DEFAULT_APP_CONFIG.appearance.fontSettings,
    ...value,
  };
}

export function mergeAppearance(value: unknown): AppearanceSettings {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.appearance;
  }
  return {
    theme: isTheme(value.theme) ? value.theme : DEFAULT_APP_CONFIG.appearance.theme,
    accentColor: isAccentColor(value.accentColor)
      ? value.accentColor
      : DEFAULT_APP_CONFIG.appearance.accentColor,
    fontSettings: mergeFontSettings(value.fontSettings),
  };
}

// ---------- editor ----------

function mergeEditorBehavior(value: unknown): EditorBehaviorConfig {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.editor.behavior;
  }
  return {
    placeholder:
      typeof value.placeholder === 'string'
        ? value.placeholder
        : DEFAULT_APP_CONFIG.editor.behavior.placeholder,
    defaultMode:
      value.defaultMode === 'rich' || value.defaultMode === 'raw'
        ? value.defaultMode
        : DEFAULT_APP_CONFIG.editor.behavior.defaultMode,
  };
}

function mergeEditorIndent(value: unknown): EditorIndentConfig {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.editor.indent;
  }
  return {
    types: isStringArray(value.types) ? value.types : DEFAULT_APP_CONFIG.editor.indent.types,
    maxIndent:
      typeof value.maxIndent === 'number' && Number.isInteger(value.maxIndent) && value.maxIndent >= 0
        ? value.maxIndent
        : DEFAULT_APP_CONFIG.editor.indent.maxIndent,
  };
}

function mergeEditorTable(value: unknown): EditorTableConfig {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.editor.table;
  }
  return {
    resizable:
      typeof value.resizable === 'boolean'
        ? value.resizable
        : DEFAULT_APP_CONFIG.editor.table.resizable,
    allowNodeSelection:
      typeof value.allowNodeSelection === 'boolean'
        ? value.allowNodeSelection
        : DEFAULT_APP_CONFIG.editor.table.allowNodeSelection,
  };
}

function mergeTaskStateDef(value: unknown): EditorTaskStateDef | null {
  if (!isRecord(value)) return null;
  if (typeof value.value !== 'string' || value.value.length === 0) return null;
  if (typeof value.label !== 'string' || value.label.length === 0) return null;

  const def: EditorTaskStateDef = {
    value: value.value,
    label: value.label,
  };
  if (typeof value.shortLabel === 'string') {
    def.shortLabel = value.shortLabel;
  }
  if (typeof value.done === 'boolean') {
    def.done = value.done;
  }
  return def;
}

function mergeEditorTask(value: unknown): EditorTaskConfig {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.editor.task;
  }

  let states: EditorTaskStateDef[] = DEFAULT_APP_CONFIG.editor.task.states;
  if (Array.isArray(value.states)) {
    const cleaned = value.states.map(mergeTaskStateDef).filter((s): s is EditorTaskStateDef => s !== null);
    if (cleaned.length > 0) {
      states = cleaned;
    }
  }

  const knownValues = new Set(states.map((s) => s.value));
  const defaultState =
    typeof value.defaultState === 'string' && knownValues.has(value.defaultState)
      ? value.defaultState
      : knownValues.has(DEFAULT_APP_CONFIG.editor.task.defaultState)
        ? DEFAULT_APP_CONFIG.editor.task.defaultState
        : states[0].value;

  const doneStates = isStringArray(value.doneStates)
    ? value.doneStates.filter((s) => knownValues.has(s))
    : DEFAULT_APP_CONFIG.editor.task.doneStates.filter((s) => knownValues.has(s));

  return {
    states,
    defaultState,
    doneStates,
    nested:
      typeof value.nested === 'boolean' ? value.nested : DEFAULT_APP_CONFIG.editor.task.nested,
  };
}

function mergeEditorCodeBlock(value: unknown): EditorCodeBlockConfig {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.editor.codeBlock;
  }
  return {
    preloadLanguages: isStringArray(value.preloadLanguages)
      ? value.preloadLanguages
      : DEFAULT_APP_CONFIG.editor.codeBlock.preloadLanguages,
  };
}

export function mergeEditor(value: unknown): EditorSettings {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG.editor;
  }
  return {
    behavior: mergeEditorBehavior(value.behavior),
    indent: mergeEditorIndent(value.indent),
    table: mergeEditorTable(value.table),
    task: mergeEditorTask(value.task),
    codeBlock: mergeEditorCodeBlock(value.codeBlock),
  };
}

// ---------- shortcuts ----------

const KNOWN_APP_ACTIONS = new Set(Object.keys(DEFAULT_APP_SHORTCUTS) as AppShortcutAction[]);
const KNOWN_EDITOR_ACTIONS = new Set(
  Object.keys(DEFAULT_EDITOR_SHORTCUTS) as EditorShortcutAction[],
);

function sanitizeBinding(value: unknown): ChordBinding | ChordBinding[] | null {
  if (typeof value === 'string') {
    return validateChord(value) ? value : null;
  }
  if (Array.isArray(value)) {
    const valid = value.filter((v) => typeof v === 'string' && validateChord(v));
    return valid.length > 0 ? (valid as ChordBinding[]) : null;
  }
  return null;
}

function mergeShortcutScope<TAction extends string>(
  value: unknown,
  knownActions: ReadonlySet<TAction>,
): Partial<Record<TAction, ChordBinding | ChordBinding[]>> {
  if (!isRecord(value)) {
    return {};
  }
  const out: Partial<Record<TAction, ChordBinding | ChordBinding[]>> = {};
  for (const [action, binding] of Object.entries(value)) {
    if (!knownActions.has(action as TAction)) continue;
    const sanitized = sanitizeBinding(binding);
    if (sanitized !== null) {
      out[action as TAction] = sanitized;
    }
  }
  return out;
}

export function mergeShortcuts(value: unknown): ShortcutsConfig {
  if (!isRecord(value)) {
    return { app: {}, editor: {} };
  }
  return {
    app: mergeShortcutScope(value.app, KNOWN_APP_ACTIONS),
    editor: mergeShortcutScope(value.editor, KNOWN_EDITOR_ACTIONS),
  };
}

// ---------- root ----------

export function normalizeConfig(value: unknown): AppConfig {
  if (!isRecord(value)) {
    return DEFAULT_APP_CONFIG;
  }

  const workspace = isRecord(value.workspace) ? value.workspace : {};

  return {
    appearance: mergeAppearance(value.appearance),
    workspace: {
      defaultWorkspacePath:
        typeof workspace.defaultWorkspacePath === 'string' &&
        workspace.defaultWorkspacePath.trim().length > 0
          ? workspace.defaultWorkspacePath
          : DEFAULT_APP_CONFIG.workspace.defaultWorkspacePath,
    },
    editor: mergeEditor(value.editor),
    shortcuts: mergeShortcuts(value.shortcuts),
  };
}
