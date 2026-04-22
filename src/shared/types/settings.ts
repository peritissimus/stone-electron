/**
 * Application Settings Types
 */

/**
 * Font settings for the application
 * Supports separate fonts for UI, editor headings, editor body, and code
 */
export interface FontSettings {
  // UI elements (sidebar, menus, buttons)
  uiFont: string;
  uiFontSize: number;

  // Editor headings (h1-h6)
  editorHeadingFont: string;

  // Editor body text (paragraphs, lists, blockquotes)
  editorBodyFont: string;
  editorFontSize: number;
  editorLineHeight: number;

  // Code blocks and inline code
  monoFont: string;
  monoFontSize: number;
}

/**
 * Default font settings using system fonts
 * Platform-aware fallback stacks for maximum compatibility
 */
export const DEFAULT_FONT_SETTINGS: FontSettings = {
  // UI - Inter with system fallbacks
  uiFont:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  uiFontSize: 13,

  // Editor headings - Barlow Semi Condensed
  editorHeadingFont:
    '"Barlow Semi Condensed", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',

  // Editor body - Barlow
  editorBodyFont:
    'Barlow, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  editorFontSize: 16,
  editorLineHeight: 1.65,

  // Code - Fira Code with fallbacks
  monoFont: '"Fira Code", "SF Mono", ui-monospace, Menlo, Monaco, monospace',
  monoFontSize: 14,
};

/**
 * System font options for each font category
 * These are curated lists of commonly available system fonts
 */
export const SYSTEM_FONT_OPTIONS = {
  ui: [
    {
      label: 'System Default',
      value:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
      label: 'SF Pro',
      value: '"SF Pro Display", "SF Pro Text", -apple-system, sans-serif',
    },
    {
      label: 'Segoe UI',
      value: '"Segoe UI", -apple-system, Roboto, sans-serif',
    },
    {
      label: 'Inter',
      value: 'Inter, -apple-system, sans-serif',
    },
  ],
  heading: [
    {
      label: 'System Default',
      value:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
      label: 'Georgia',
      value: 'Georgia, "Times New Roman", serif',
    },
    {
      label: 'Palatino',
      value: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    },
    {
      label: 'Baskerville',
      value: 'Baskerville, "Baskerville Old Face", "Hoefler Text", Georgia, serif',
    },
    {
      label: 'Hoefler Text',
      value: '"Hoefler Text", Baskerville, Georgia, serif',
    },
  ],
  body: [
    {
      label: 'System Default',
      value:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    {
      label: 'Georgia',
      value: 'Georgia, "Times New Roman", serif',
    },
    {
      label: 'Charter',
      value: 'Charter, Georgia, serif',
    },
    {
      label: 'Iowan Old Style',
      value: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
    },
    {
      label: 'Seravek',
      value: 'Seravek, "Gill Sans Nova", "Trebuchet MS", sans-serif',
    },
  ],
  code: [
    {
      label: 'SF Mono',
      value: '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
    },
    {
      label: 'Monaco',
      value: 'Monaco, "SF Mono", Menlo, monospace',
    },
    {
      label: 'Menlo',
      value: 'Menlo, Monaco, "Courier New", monospace',
    },
    {
      label: 'JetBrains Mono',
      value: '"JetBrains Mono", Menlo, Monaco, monospace',
    },
    {
      label: 'Cascadia Code',
      value: '"Cascadia Code", Consolas, Menlo, monospace',
    },
    {
      label: 'Consolas',
      value: 'Consolas, Monaco, "Courier New", monospace',
    },
  ],
};

export type AppTheme = 'light' | 'dark' | 'system';

export type AppAccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green' | 'teal';

export interface AppearanceSettings {
  theme: AppTheme;
  accentColor: AppAccentColor;
  fontSettings: FontSettings;
}

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  theme: 'system',
  accentColor: 'blue',
  fontSettings: DEFAULT_FONT_SETTINGS,
};

export interface WorkspaceConfig {
  defaultWorkspacePath: string;
}

/**
 * Editor settings — behavior knobs for the TipTap editor.
 * Lives in config.json (typed AppConfig), never in the DB settings table.
 */
export interface EditorBehaviorConfig {
  placeholder: string;
  defaultMode: 'rich' | 'raw';
}

export interface EditorIndentConfig {
  types: string[];
  maxIndent: number;
}

export interface EditorTableConfig {
  resizable: boolean;
  allowNodeSelection: boolean;
}

export interface EditorTaskStateDef {
  value: string;
  label: string;
  shortLabel?: string;
  done?: boolean;
}

export interface EditorTaskConfig {
  states: EditorTaskStateDef[];
  defaultState: string;
  doneStates: string[];
  nested: boolean;
}

export interface EditorCodeBlockConfig {
  preloadLanguages: string[];
}

export interface EditorSettings {
  behavior: EditorBehaviorConfig;
  indent: EditorIndentConfig;
  table: EditorTableConfig;
  task: EditorTaskConfig;
  codeBlock: EditorCodeBlockConfig;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  behavior: {
    placeholder: 'Type / for commands, or start writing...',
    defaultMode: 'rich',
  },
  indent: {
    types: ['paragraph', 'heading'],
    maxIndent: 8,
  },
  table: {
    resizable: false,
    allowNodeSelection: true,
  },
  task: {
    states: [
      { value: 'todo', label: 'TODO' },
      { value: 'doing', label: 'DOING' },
      { value: 'waiting', label: 'WAIT', shortLabel: 'WAIT' },
      { value: 'hold', label: 'HOLD' },
      { value: 'done', label: 'DONE', done: true },
      { value: 'canceled', label: 'CANCELED', done: true, shortLabel: 'CAN' },
      { value: 'idea', label: 'IDEA' },
    ],
    defaultState: 'todo',
    doneStates: ['done', 'canceled'],
    nested: true,
  },
  codeBlock: {
    preloadLanguages: ['javascript', 'typescript', 'json'],
  },
};

/**
 * Keyboard shortcut configuration.
 *
 * Chord strings use TipTap/ProseMirror format: "Mod-Shift-Enter", "Tab",
 * "Mod-,", etc. "Mod" is the platform modifier (Cmd on macOS, Ctrl elsewhere).
 *
 * `ShortcutsConfig` stores SPARSE OVERRIDES — only chords the user has changed
 * from the defaults defined in src/shared/constants/defaultShortcuts.ts.
 */
export type ChordBinding = string;

export type AppShortcutAction =
  | 'save'
  | 'newNote'
  | 'newPersonalNote'
  | 'newWorkNote'
  | 'settings'
  | 'commandCenter'
  | 'toggleSidebar'
  | 'goHome'
  | 'closeNote'
  | 'todayJournal'
  | 'findReplace'
  | 'toggleEditorMode'
  | 'focusSidebar';

export type EditorShortcutAction =
  | 'indent'
  | 'outdent'
  | 'taskCycleForward'
  | 'taskCycleBackward'
  | 'tableNextCell'
  | 'tablePrevCell'
  | 'tableExit';

export interface ShortcutsConfig {
  app: Partial<Record<AppShortcutAction, ChordBinding | ChordBinding[]>>;
  editor: Partial<Record<EditorShortcutAction, ChordBinding | ChordBinding[]>>;
}

export const DEFAULT_SHORTCUTS_CONFIG: ShortcutsConfig = {
  app: {},
  editor: {},
};

/**
 * Note location policy — where different kinds of notes go on disk.
 *
 * Replaces hardcoded folder names ('Journal', 'Personal', etc.) scattered
 * across backend use cases. All paths are relative to the workspace root
 * and use forward slashes.
 */
export interface QuickNoteSlotFolders {
  personal: string;
  work: string;
}

export interface NoteLocationPolicy {
  /** Folder where journal / daily notes live (default: "Journal"). */
  journalFolder: string;
  /** Default folder for new notes when the caller doesn't specify one (default: "Personal"). */
  defaultNoteFolder: string;
  /** Folder per quick-note slot. */
  quickNoteSlotFolders: QuickNoteSlotFolders;
}

export const DEFAULT_NOTE_LOCATION_POLICY: NoteLocationPolicy = {
  journalFolder: 'Journal',
  defaultNoteFolder: 'Personal',
  quickNoteSlotFolders: {
    personal: 'Personal',
    work: 'Work',
  },
};

export interface NotesConfig {
  locationPolicy: NoteLocationPolicy;
}

export const DEFAULT_NOTES_CONFIG: NotesConfig = {
  locationPolicy: DEFAULT_NOTE_LOCATION_POLICY,
};

export interface AppConfig {
  appearance: AppearanceSettings;
  workspace: WorkspaceConfig;
  editor: EditorSettings;
  shortcuts: ShortcutsConfig;
  notes: NotesConfig;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  workspace: {
    defaultWorkspacePath: 'NoteBook',
  },
  editor: DEFAULT_EDITOR_SETTINGS,
  shortcuts: DEFAULT_SHORTCUTS_CONFIG,
  notes: DEFAULT_NOTES_CONFIG,
};

/**
 * Complete application settings
 */
export interface AppSettings {
  appearance: AppearanceSettings;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appearance: DEFAULT_APPEARANCE_SETTINGS,
};
