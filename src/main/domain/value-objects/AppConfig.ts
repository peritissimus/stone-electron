/**
 * AppConfig Domain Contract
 *
 * Typed user preferences persisted by IAppConfigRepository. This mirrors the
 * serializable shared settings shape without importing from the shared layer,
 * keeping domain ports dependency-free.
 */

export interface FontSettings {
  uiFont: string;
  uiFontSize: number;
  editorHeadingFont: string;
  editorBodyFont: string;
  editorFontSize: number;
  editorLineHeight: number;
  monoFont: string;
  monoFontSize: number;
}

export const DEFAULT_FONT_SETTINGS: FontSettings = {
  uiFont:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  uiFontSize: 13,
  editorHeadingFont:
    '"Barlow Semi Condensed", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  editorBodyFont:
    'Barlow, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  editorFontSize: 16,
  editorLineHeight: 1.65,
  monoFont: '"Fira Code", "SF Mono", ui-monospace, Menlo, Monaco, monospace',
  monoFontSize: 14,
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
  | 'focusSidebar'
  | 'openFile'
  | 'askNotes';

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

export const DEFAULT_APP_SHORTCUTS: Record<AppShortcutAction, ChordBinding> = {
  save: 'Mod-s',
  newNote: 'Mod-n',
  newPersonalNote: 'Mod-Shift-p',
  newWorkNote: 'Mod-Shift-w',
  settings: 'Mod-,',
  commandCenter: 'Mod-k',
  toggleSidebar: 'Mod-\\',
  goHome: 'Mod-Shift-h',
  closeNote: 'Mod-w',
  todayJournal: 'Mod-j',
  findReplace: 'Mod-f',
  toggleEditorMode: 'Mod-Shift-m',
  focusSidebar: 'Mod-e',
  openFile: 'Mod-o',
  askNotes: 'Mod-Shift-a',
};

export const DEFAULT_EDITOR_SHORTCUTS: Record<EditorShortcutAction, ChordBinding> = {
  indent: 'Tab',
  outdent: 'Shift-Tab',
  taskCycleForward: 'Mod-Shift-Enter',
  taskCycleBackward: 'Mod-Alt-Shift-Enter',
  tableNextCell: 'Tab',
  tablePrevCell: 'Shift-Tab',
  tableExit: 'Mod-Enter',
};

export const RESERVED_CHORDS: ReadonlySet<string> = new Set([
  'Mod-b',
  'Mod-i',
  'Mod-`',
  'Mod-Shift-x',
  'Mod-z',
  'Mod-Shift-z',
  'Mod-y',
  'Mod-Shift-7',
  'Mod-Shift-8',
  'Mod-Shift-9',
  'Mod-Alt-1',
  'Mod-Alt-2',
  'Mod-Alt-3',
  'Mod-Alt-4',
  'Mod-Alt-5',
  'Mod-Alt-6',
  'Mod-Alt-c',
  'Mod-Shift-b',
  'Shift-Enter',
]);

export const DEFAULT_SHORTCUTS_CONFIG: ShortcutsConfig = {
  app: {},
  editor: {},
};

export interface QuickNoteSlotFolders {
  personal: string;
  work: string;
}

export interface NoteLocationPolicy {
  journalFolder: string;
  defaultNoteFolder: string;
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

export type AIProviderMode = 'local' | 'cloud' | 'disabled';

export interface AIModelConfig {
  textModel: string;
  embeddingModel: string;
}

export interface AIPrivacyConfig {
  allowCloudInference: boolean;
  allowSendingNoteContent: boolean;
  allowSendingMetadata: boolean;
}

export interface AIIndexingConfig {
  enabled: boolean;
  providerMode: AIProviderMode;
  chunkMaxCharacters: number;
  chunkOverlapCharacters: number;
  batchSize: number;
  autoIndexOnSave: boolean;
}

export interface AIConfig {
  indexing: AIIndexingConfig;
  models: AIModelConfig;
  privacy: AIPrivacyConfig;
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  indexing: {
    enabled: true,
    providerMode: 'local',
    chunkMaxCharacters: 1800,
    chunkOverlapCharacters: 180,
    batchSize: 16,
    autoIndexOnSave: true,
  },
  models: {
    textModel: 'openai/gpt-5.4-mini',
    embeddingModel: 'openai/text-embedding-3-small',
  },
  privacy: {
    allowCloudInference: false,
    allowSendingNoteContent: false,
    allowSendingMetadata: false,
  },
};

export interface AppConfig {
  appearance: AppearanceSettings;
  workspace: WorkspaceConfig;
  editor: EditorSettings;
  shortcuts: ShortcutsConfig;
  notes: NotesConfig;
  ai: AIConfig;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  workspace: {
    defaultWorkspacePath: 'NoteBook',
  },
  editor: DEFAULT_EDITOR_SETTINGS,
  shortcuts: DEFAULT_SHORTCUTS_CONFIG,
  notes: DEFAULT_NOTES_CONFIG,
  ai: DEFAULT_AI_CONFIG,
};
