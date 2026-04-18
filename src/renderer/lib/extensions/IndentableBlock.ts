/**
 * IndentableBlock Extension - Block indentation for paragraphs/headings
 *
 * Adds indent level support to paragraphs and headings.
 * Tab increases indent, Shift+Tab decreases indent.
 *
 * Lists use native TipTap sink/lift for proper markdown parity.
 */

import { Extension } from '@tiptap/core';
import { sinkListItem, liftListItem } from '@tiptap/pm/schema-list';

// Extend nodes to support indent attribute
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indentableBlock: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
      setIndent: (level: number) => ReturnType;
    };
  }
}

export interface IndentableBlockOptions {
  types: string[];
  maxIndent: number;
}

export const IndentableBlock = Extension.create<IndentableBlockOptions>({
  name: 'indentableBlock',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      maxIndent: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const indent = element.dataset.indent;
              return indent ? parseInt(indent, 10) : 0;
            },
            renderHTML: (attributes) => {
              if (!attributes.indent || attributes.indent === 0) {
                return {};
              }
              return {
                'data-indent': attributes.indent,
                style: `margin-left: ${attributes.indent * 24}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          let changed = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0;
              if (currentIndent < this.options.maxIndent) {
                if (dispatch) {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    indent: currentIndent + 1,
                  });
                }
                changed = true;
              }
            }
          });

          return changed;
        },

      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          let changed = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0;
              if (currentIndent > 0) {
                if (dispatch) {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    indent: currentIndent - 1,
                  });
                }
                changed = true;
              }
            }
          });

          return changed;
        },

      setIndent:
        (level: number) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;
          const clampedLevel = Math.max(0, Math.min(level, this.options.maxIndent));
          let changed = false;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: clampedLevel,
                });
              }
              changed = true;
            }
          });

          return changed;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // Check if in a list item - use native nesting for markdown parity
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'listItem') {
            const listItemType = state.schema.nodes.listItem;
            if (listItemType) {
              return sinkListItem(listItemType)(state, editor.view.dispatch);
            }
          }
          if (node.type.name === 'taskItem') {
            const taskItemType = state.schema.nodes.taskItem;
            if (taskItemType) {
              return sinkListItem(taskItemType)(state, editor.view.dispatch);
            }
          }
        }

        // Not in list - use visual indent for paragraphs/headings
        return editor.commands.indent();
      },

      'Shift-Tab': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // Check if in a list item - use native lift for markdown parity
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'listItem') {
            const listItemType = state.schema.nodes.listItem;
            if (listItemType) {
              return liftListItem(listItemType)(state, editor.view.dispatch);
            }
          }
          if (node.type.name === 'taskItem') {
            const taskItemType = state.schema.nodes.taskItem;
            if (taskItemType) {
              return liftListItem(taskItemType)(state, editor.view.dispatch);
            }
          }
        }

        // Not in list - use visual outdent for paragraphs/headings
        return editor.commands.outdent();
      },
    };
  },
});
