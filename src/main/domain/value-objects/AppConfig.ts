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

export type AppTheme = 'light' | 'dark' | 'system';

export type AppAccentColor = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green' | 'teal';

export interface AppearanceSettings {
  theme: AppTheme;
  accentColor: AppAccentColor;
  fontSettings: FontSettings;
}

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
  | 'openFile';

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

export interface QuickNoteSlotFolders {
  personal: string;
  work: string;
}

export interface NoteLocationPolicy {
  journalFolder: string;
  defaultNoteFolder: string;
  quickNoteSlotFolders: QuickNoteSlotFolders;
}

export interface NotesConfig {
  locationPolicy: NoteLocationPolicy;
}

export interface AppConfig {
  appearance: AppearanceSettings;
  workspace: WorkspaceConfig;
  editor: EditorSettings;
  shortcuts: ShortcutsConfig;
  notes: NotesConfig;
}
