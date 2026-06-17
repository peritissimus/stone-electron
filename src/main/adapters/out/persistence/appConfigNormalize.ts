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
  type AIConfig,
  type AIIndexingConfig,
  type AIModelConfig,
  type AIPrivacyConfig,
  type AIProviderMode,
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
  type NoteLocationPolicy,
  type NotesConfig,
  type QuickNoteSlotFolders,
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

// ---------- notes ----------

function sanitizeFolderName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  return trimmed.length > 0 ? trimmed : fallback;
}

function mergeQuickNoteSlotFolders(value: unknown): QuickNoteSlotFolders {
  const defaults = DEFAULT_APP_CONFIG.notes.locationPolicy.quickNoteSlotFolders;
  if (!isRecord(value)) {
    return { ...defaults };
  }
  return {
    personal: sanitizeFolderName(value.personal, defaults.personal),
    work: sanitizeFolderName(value.work, defaults.work),
  };
}

function mergeLocationPolicy(value: unknown): NoteLocationPolicy {
  const defaults = DEFAULT_APP_CONFIG.notes.locationPolicy;
  if (!isRecord(value)) {
    return {
      journalFolder: defaults.journalFolder,
      defaultNoteFolder: defaults.defaultNoteFolder,
      quickNoteSlotFolders: { ...defaults.quickNoteSlotFolders },
    };
  }
  return {
    journalFolder: sanitizeFolderName(value.journalFolder, defaults.journalFolder),
    defaultNoteFolder: sanitizeFolderName(value.defaultNoteFolder, defaults.defaultNoteFolder),
    quickNoteSlotFolders: mergeQuickNoteSlotFolders(value.quickNoteSlotFolders),
  };
}

export function mergeNotes(value: unknown): NotesConfig {
  if (!isRecord(value)) {
    return {
      locationPolicy: mergeLocationPolicy(undefined),
    };
  }
  return {
    locationPolicy: mergeLocationPolicy(value.locationPolicy),
  };
}

// ---------- ai ----------

function isProviderMode(value: unknown): value is AIProviderMode {
  return value === 'local' || value === 'cloud' || value === 'disabled';
}

function sanitizePositiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function sanitizeNonNegativeInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function mergeAIIndexing(value: unknown): AIIndexingConfig {
  const defaults = DEFAULT_APP_CONFIG.ai.indexing;
  if (!isRecord(value)) {
    return { ...defaults };
  }

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : defaults.enabled,
    providerMode: isProviderMode(value.providerMode) ? value.providerMode : defaults.providerMode,
    chunkMaxCharacters: sanitizePositiveInt(
      value.chunkMaxCharacters,
      defaults.chunkMaxCharacters,
    ),
    chunkOverlapCharacters: sanitizeNonNegativeInt(
      value.chunkOverlapCharacters,
      defaults.chunkOverlapCharacters,
    ),
    batchSize: sanitizePositiveInt(value.batchSize, defaults.batchSize),
    autoIndexOnSave:
      typeof value.autoIndexOnSave === 'boolean'
        ? value.autoIndexOnSave
        : defaults.autoIndexOnSave,
  };
}

/**
 * Sanitize an OpenAI base-URL override. Empty/whitespace → '' (official API).
 * Anything else must parse as an http(s) URL, otherwise we drop back to ''
 * rather than persist a value that could send note content somewhere
 * unintended. Returns the trimmed URL with no trailing slash.
 */
function sanitizeOpenAIBaseUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return trimmed.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function mergeAIModels(value: unknown): AIModelConfig {
  const defaults = DEFAULT_APP_CONFIG.ai.models;
  if (!isRecord(value)) {
    return { ...defaults };
  }

  return {
    textModel:
      typeof value.textModel === 'string' && value.textModel.trim().length > 0
        ? value.textModel
        : defaults.textModel,
    embeddingModel:
      typeof value.embeddingModel === 'string' && value.embeddingModel.trim().length > 0
        ? value.embeddingModel
        : defaults.embeddingModel,
    openaiBaseUrl: sanitizeOpenAIBaseUrl(value.openaiBaseUrl),
  };
}

function mergeAIPrivacy(value: unknown): AIPrivacyConfig {
  const defaults = DEFAULT_APP_CONFIG.ai.privacy;
  if (!isRecord(value)) {
    return { ...defaults };
  }

  const allowCloudInference =
    typeof value.allowCloudInference === 'boolean'
      ? value.allowCloudInference
      : defaults.allowCloudInference;

  return {
    allowCloudInference,
    allowSendingNoteContent:
      allowCloudInference && typeof value.allowSendingNoteContent === 'boolean'
        ? value.allowSendingNoteContent
        : false,
    allowSendingMetadata:
      allowCloudInference && typeof value.allowSendingMetadata === 'boolean'
        ? value.allowSendingMetadata
        : false,
  };
}

export function mergeAI(value: unknown): AIConfig {
  if (!isRecord(value)) {
    return {
      indexing: mergeAIIndexing(undefined),
      models: mergeAIModels(undefined),
      privacy: mergeAIPrivacy(undefined),
    };
  }

  return {
    indexing: mergeAIIndexing(value.indexing),
    models: mergeAIModels(value.models),
    privacy: mergeAIPrivacy(value.privacy),
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
    notes: mergeNotes(value.notes),
    ai: mergeAI(value.ai),
    meetings: mergeMeetings(value.meetings),
    onboarding: mergeOnboarding(value.onboarding),
    quickCapture: mergeQuickCapture(value.quickCapture),
    integrations: mergeIntegrations(value.integrations),
  };
}

function mergeIntegrations(value: unknown): AppConfig['integrations'] {
  if (!isRecord(value)) return { ...DEFAULT_APP_CONFIG.integrations };
  return {
    linearApiKey:
      typeof value.linearApiKey === 'string'
        ? value.linearApiKey.trim()
        : DEFAULT_APP_CONFIG.integrations.linearApiKey,
  };
}

function mergeMeetings(value: unknown): AppConfig['meetings'] {
  if (!isRecord(value)) return { ...DEFAULT_APP_CONFIG.meetings };
  return {
    audioRetentionDays:
      typeof value.audioRetentionDays === 'number' && Number.isFinite(value.audioRetentionDays)
        ? value.audioRetentionDays
        : DEFAULT_APP_CONFIG.meetings.audioRetentionDays,
  };
}

function mergeOnboarding(value: unknown): AppConfig['onboarding'] {
  const defaults = DEFAULT_APP_CONFIG.onboarding;
  if (!isRecord(value)) return { completed: false, completedAt: null, steps: { ...defaults.steps } };

  const stepsValue = isRecord(value.steps) ? value.steps : {};
  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;

  return {
    completed: bool(value.completed, defaults.completed),
    completedAt:
      typeof value.completedAt === 'string' && value.completedAt.trim().length > 0
        ? value.completedAt
        : null,
    steps: {
      workspace: bool(stepsValue.workspace, defaults.steps.workspace),
      permissions: bool(stepsValue.permissions, defaults.steps.permissions),
      ai: bool(stepsValue.ai, defaults.steps.ai),
      models: bool(stepsValue.models, defaults.steps.models),
      shortcuts: bool(stepsValue.shortcuts, defaults.steps.shortcuts),
    },
  };
}

function mergeQuickCapture(value: unknown): AppConfig['quickCapture'] {
  const defaults = DEFAULT_APP_CONFIG.quickCapture;
  if (!isRecord(value)) return { ...defaults };
  // An explicitly-empty string is valid (means "no global hotkey"). Only fall
  // back to the default when the field is missing or not a string.
  return {
    shortcut: typeof value.shortcut === 'string' ? value.shortcut.trim() : defaults.shortcut,
  };
}
