/**
 * Table Navigation Extension
 *
 * Provides Notion-like keyboard navigation for tables:
 * - Tab: Move to next cell (or create new row if at end)
 * - Shift+Tab: Move to previous cell
 * - Arrow Down in last cell: Exit table, create paragraph below
 * - Cmd+Enter: Exit table from anywhere
 * - Enter in empty last cell: Exit table instead of staying
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { TextSelection } from '@tiptap/pm/state';
import { logger } from '@renderer/lib/logger';

function isInTable(state: any): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') {
      return true;
    }
  }
  return false;
}

function isInLastCell(state: any): boolean {
  const { $from } = state.selection;

  let tableDepth = -1;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') {
      tableDepth = d;
      break;
    }
  }

  if (tableDepth === -1) return false;

  const table = $from.node(tableDepth);
  const rows = table.content.content;
  const lastRow = rows[rows.length - 1];

  if (!lastRow) return false;

  const lastRowCells = lastRow.content.content;
  const lastCell = lastRowCells[lastRowCells.length - 1];

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      return node === lastCell;
    }
  }

  return false;
}

function isCurrentCellEmpty(state: any): boolean {
  const { $from } = state.selection;

  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      return node.content.size <= 2;
    }
  }

  return false;
}

function exitTable(state: any, dispatch: any): boolean {
  const { $from } = state.selection;

  let tablePos = -1;
  let tableDepth = -1;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') {
      tablePos = $from.before(d);
      tableDepth = d;
      break;
    }
  }

  if (tablePos === -1) return false;

  const table = $from.node(tableDepth);
  const tableEnd = tablePos + table.nodeSize;

  const $after = state.doc.resolve(tableEnd);
  const hasContentAfter = $after.nodeAfter !== null;

  if (dispatch) {
    const tr = state.tr;

    if (!hasContentAfter) {
      const paragraph = state.schema.nodes.paragraph.create();
      tr.insert(tableEnd, paragraph);
    }

    const newPos = tableEnd + 1;
    tr.setSelection(TextSelection.create(tr.doc, newPos));
    tr.scrollIntoView();

    dispatch(tr);
  }

  return true;
}

export const TableNavigation = Extension.create({
  name: 'tableNavigation',

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!isInTable(editor.state)) return false;

        if (editor.commands.goToNextCell()) {
          return true;
        }

        if (editor.commands.addRowAfter && editor.commands.addRowAfter()) {
          editor.commands.goToNextCell();
          return true;
        }

        return false;
      },

      'Shift-Tab': ({ editor }) => {
        if (!isInTable(editor.state)) return false;
        return editor.commands.goToPreviousCell();
      },

      'Mod-Enter': ({ editor }) => {
        if (!isInTable(editor.state)) return false;

        logger.info('[TableNavigation] Cmd+Enter - exiting table');
        return exitTable(editor.state, editor.view.dispatch);
      },

      ArrowDown: ({ editor }) => {
        if (!isInTable(editor.state)) return false;

        const { $from } = editor.state.selection;
        const cell = $from.node($from.depth - 1);

        const endOfCell = $from.parentOffset === cell.content.size;

        if (endOfCell && isInLastCell(editor.state)) {
          logger.info('[TableNavigation] Arrow down in last cell - exiting table');
          return exitTable(editor.state, editor.view.dispatch);
        }

        return false;
      },

      Enter: ({ editor }) => {
        if (!isInTable(editor.state)) return false;

        if (isInLastCell(editor.state) && isCurrentCellEmpty(editor.state)) {
          logger.info('[TableNavigation] Enter in empty last cell - exiting table');
          return exitTable(editor.state, editor.view.dispatch);
        }

        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tableNavigation'),
        props: {
          decorations(_state) {
            return null;
          },
        },
      }),
    ];
  },
});
