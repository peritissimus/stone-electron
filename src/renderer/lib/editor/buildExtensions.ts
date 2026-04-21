/**
 * TipTap extension factory.
 *
 * Pure function of (editorConfig, resolvedShortcuts) → extensions array.
 * Used by useTipTapEditor; isolates extension assembly from React lifecycle
 * so the same code can be tested or reconstructed without re-mounting.
 *
 * Notes:
 * - Extension order matters for TipTap keymap precedence (later wins).
 *   Custom extensions that override StarterKit chords are intentionally
 *   placed *after* StarterKit.
 * - Per Step 6: editor settings flow into Placeholder, IndentableBlock,
 *   Table, and LogseqTaskItem here. Editor-scope shortcuts flow into
 *   IndentableBlock, LogseqTaskItem, and TableNavigation.
 */

import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { lowlight } from 'lowlight';

import { ImageWithMenu } from '@renderer/lib/extensions/ImageWithMenu';
import LogseqTaskItem from '@renderer/lib/extensions/LogseqTaskItem';
import { CodeBlockWithMermaid } from '@renderer/lib/extensions/CodeBlockWithMermaid';
import { SlashCommand } from '@renderer/lib/extensions/SlashCommand';
import { NoteLink } from '@renderer/lib/extensions/NoteLink';
import { Timestamp } from '@renderer/lib/extensions/Timestamp';
import { TaskMarker } from '@renderer/lib/extensions/TaskMarker';
import { IndentableBlock } from '@renderer/lib/extensions/IndentableBlock';
import { SearchAndReplace } from '@renderer/lib/extensions/SearchAndReplace';
import { MarkdownPaste } from '@renderer/lib/extensions/MarkdownPaste';
import { TableNavigation } from '@renderer/lib/extensions/TableNavigation';
import { BlockDragDrop } from '@renderer/lib/extensions/BlockDragDrop';

import type { EditorSettings } from '@shared/types/settings';
import type { ResolvedShortcuts } from '@shared/utils/shortcuts';

export interface BuildEditorExtensionsDeps {
  editorConfig: EditorSettings;
  shortcuts: ResolvedShortcuts;
  fetchNotesForAutocomplete: NonNullable<Parameters<typeof NoteLink.configure>[0]>['fetchNotes'];
}

/**
 * Pick the first chord for an editor action, falling back to the provided
 * default. Multi-chord bindings (e.g. ['Tab', 'Mod-]'] for indent) only
 * surface their first entry to the extension's addKeyboardShortcuts() —
 * extensions accept a single chord per action today. Multi-chord support
 * is a follow-up.
 */
function pickChord(
  shortcuts: ResolvedShortcuts,
  action: keyof ResolvedShortcuts['editor'],
  fallback: string,
): string {
  const chord = shortcuts.editor[action]?.chords[0];
  return chord ?? fallback;
}

export function buildEditorExtensions(deps: BuildEditorExtensionsDeps) {
  const { editorConfig, shortcuts, fetchNotesForAutocomplete } = deps;

  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,
    }),
    CodeBlockWithMermaid.configure({
      lowlight,
      HTMLAttributes: { class: 'code-block-wrapper' },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'text-primary underline hover:text-primary/80 cursor-pointer' },
    }),
    ImageWithMenu.configure({
      HTMLAttributes: { class: 'max-w-full h-auto rounded-lg shadow-sm' },
    }),
    Highlight.configure({
      HTMLAttributes: { class: 'highlight-mark' },
    }),
    TaskList.configure({
      HTMLAttributes: { class: 'task-list' },
    }),
    LogseqTaskItem.configure({
      HTMLAttributes: { class: 'task-item' },
      nested: editorConfig.task.nested,
      states: editorConfig.task.states,
      defaultState: editorConfig.task.defaultState,
      doneStates: editorConfig.task.doneStates,
      bindings: {
        cycleForward: pickChord(shortcuts, 'taskCycleForward', 'Mod-Shift-Enter'),
        cycleBackward: pickChord(shortcuts, 'taskCycleBackward', 'Mod-Alt-Shift-Enter'),
      },
    }),
    Table.configure({
      resizable: editorConfig.table.resizable,
      allowTableNodeSelection: editorConfig.table.allowNodeSelection,
      HTMLAttributes: { class: 'stone-table' },
    }),
    TableRow,
    TableHeader.configure({
      HTMLAttributes: { class: 'stone-table-header' },
    }),
    TableCell.configure({
      HTMLAttributes: { class: 'stone-table-cell' },
    }),
    Placeholder.configure({
      placeholder: editorConfig.behavior.placeholder,
    }),
    SlashCommand,
    NoteLink.configure({
      fetchNotes: fetchNotesForAutocomplete,
      HTMLAttributes: { class: 'note-link' },
    }),
    IndentableBlock.configure({
      types: editorConfig.indent.types,
      maxIndent: editorConfig.indent.maxIndent,
      bindings: {
        indent: pickChord(shortcuts, 'indent', 'Tab'),
        outdent: pickChord(shortcuts, 'outdent', 'Shift-Tab'),
      },
    }),
    SearchAndReplace.configure({
      highlightClass: 'search-highlight',
      activeHighlightClass: 'search-highlight-active',
    }),
    Timestamp,
    TaskMarker,
    MarkdownPaste,
    TableNavigation.configure({
      bindings: {
        nextCell: pickChord(shortcuts, 'tableNextCell', 'Tab'),
        prevCell: pickChord(shortcuts, 'tablePrevCell', 'Shift-Tab'),
        exit: pickChord(shortcuts, 'tableExit', 'Mod-Enter'),
      },
    }),
    BlockDragDrop,
  ];
}
