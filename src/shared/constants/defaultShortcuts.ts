/**
 * Default keyboard shortcuts.
 *
 * The single source of truth for built-in chord bindings, shared by both
 * processes. ShortcutsConfig in AppConfig stores only sparse overrides;
 * resolveShortcuts() merges these defaults with overrides at runtime.
 *
 * Chord format: TipTap/ProseMirror style — "Mod-Shift-Enter", "Tab", "Mod-,".
 * "Mod" is the platform modifier (Cmd on macOS, Ctrl elsewhere).
 */

import type {
  AppShortcutAction,
  ChordBinding,
  EditorShortcutAction,
} from '../types/settings';

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

/**
 * Editor shortcuts. Some chords (Tab, Shift-Tab) intentionally appear on
 * multiple actions because the underlying extensions disambiguate by cursor
 * context (in-table vs in-list vs paragraph). The conflict detector flags
 * these duplicates as informational, not errors — see detectConflicts().
 */
export const DEFAULT_EDITOR_SHORTCUTS: Record<EditorShortcutAction, ChordBinding> = {
  indent: 'Tab',
  outdent: 'Shift-Tab',
  taskCycleForward: 'Mod-Shift-Enter',
  taskCycleBackward: 'Mod-Alt-Shift-Enter',
  tableNextCell: 'Tab',
  tablePrevCell: 'Shift-Tab',
  tableExit: 'Mod-Enter',
};

/**
 * Reserved chords owned by TipTap StarterKit / ProseMirror built-ins.
 * Customizations colliding with these would silently shadow expected
 * editor behavior, so SetShortcutUseCase rejects them server-side.
 *
 * Conservative list — only chords whose default behavior users would
 * unambiguously expect to keep working.
 */
export const RESERVED_CHORDS: ReadonlySet<string> = new Set([
  // Marks
  'Mod-b',
  'Mod-i',
  'Mod-`',
  // Strike / underline (StarterKit / common)
  'Mod-Shift-x',
  // History
  'Mod-z',
  'Mod-Shift-z',
  'Mod-y',
  // Lists
  'Mod-Shift-7',
  'Mod-Shift-8',
  'Mod-Shift-9',
  // Headings
  'Mod-Alt-1',
  'Mod-Alt-2',
  'Mod-Alt-3',
  'Mod-Alt-4',
  'Mod-Alt-5',
  'Mod-Alt-6',
  // Code block
  'Mod-Alt-c',
  // Blockquote
  'Mod-Shift-b',
  // Hard break (Mod-Enter is intentionally NOT reserved here — Stone's
  // TableNavigation extension claims it for tableExit, and rebinding to it
  // is a valid user choice. Shift-Enter remains reserved as the standard
  // hard-break chord.)
  'Shift-Enter',
]);
