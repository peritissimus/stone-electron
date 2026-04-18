/**
 * TaskMarker Extension - Inline task state markers (TODO, DOING, DONE, etc.)
 *
 * This extension provides:
 * 1. A custom inline node type for task markers
 * 2. Automatic detection when typing task keywords at line start
 * 3. Clickable badges that cycle through states (via ProseMirror plugin)
 * 4. Styled badge display via CSS
 *
 * Note: Uses native DOM rendering (renderHTML) instead of React NodeView
 * for better clipboard serialization and copy/paste support.
 */

import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface TaskMarkerOptions {
  HTMLAttributes: Record<string, unknown>;
  states: TaskState[];
  defaultState: string;
}

export interface TaskState {
  value: string;
  label: string;
  shortLabel?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskMarker: {
      /**
       * Insert a task marker with a specific state
       */
      insertTaskMarker: (state: string) => ReturnType;
      /**
       * Cycle task marker to next state
       */
      cycleTaskMarker: () => ReturnType;
    };
  }
}

// Default task states (Logseq-inspired)
const DEFAULT_STATES: TaskState[] = [
  { value: 'todo', label: 'TODO' },
  { value: 'doing', label: 'DOING' },
  { value: 'done', label: 'DONE' },
  { value: 'waiting', label: 'WAITING', shortLabel: 'WAIT' },
  { value: 'hold', label: 'HOLD' },
  { value: 'canceled', label: 'CANCELED', shortLabel: 'CAN' },
  { value: 'idea', label: 'IDEA' },
];

// Regex to match task markers at word boundary followed by space
const TASK_MARKER_INPUT_REGEX = /^(TODO|DOING|DONE|WAITING|HOLD|CANCELED|CANCELLED|IDEA)\s$/i;

// Plugin key for task marker click handling
const taskMarkerPluginKey = new PluginKey('taskMarkerClick');

export const TaskMarker = Node.create<TaskMarkerOptions>({
  name: 'taskMarker',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      states: DEFAULT_STATES,
      defaultState: 'todo',
    };
  },

  addAttributes() {
    return {
      state: {
        default: 'todo',
        parseHTML: (element) => element.dataset.state || 'todo',
        renderHTML: (attributes) => ({
          'data-state': attributes.state,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="task-marker"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const state = node.attrs.state as string;
    const stateConfig = this.options.states.find((s) => s.value === state);
    const label = stateConfig?.shortLabel || stateConfig?.label || state.toUpperCase();

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'task-marker',
        'data-state': state,
        class: 'task-marker-badge',
      }),
      label,
    ];
  },

  addCommands() {
    return {
      insertTaskMarker:
        (state: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { state },
          });
        },
      cycleTaskMarker:
        () =>
        ({ state, commands }) => {
          const { selection } = state;
          const node = state.doc.nodeAt(selection.from);

          if (node?.type.name === this.name) {
            const currentState = node.attrs.state as string;
            const states = this.options.states;
            const currentIndex = states.findIndex((s) => s.value === currentState);
            const nextIndex = (currentIndex + 1) % states.length;

            return commands.updateAttributes(this.name, {
              state: states[nextIndex].value,
            });
          }

          return false;
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: TASK_MARKER_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const markerText = match[1].toUpperCase();
          const normalizedMarker = markerText === 'CANCELLED' ? 'CANCELED' : markerText;
          const taskState = normalizedMarker.toLowerCase();

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, this.type.create({ state: taskState }));
          tr.insertText(' ');
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: taskMarkerPluginKey,
        props: {
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;

            if (target.dataset.type === 'task-marker' || target.closest('[data-type="task-marker"]')) {
              const markerElement =
                target.dataset.type === 'task-marker'
                  ? target
                  : (target.closest('[data-type="task-marker"]') as HTMLElement);

              if (!markerElement) return false;

              const { state, dispatch } = view;

              let foundPos: number | null = null;
              let foundNode: any = null;

              for (let i = -1; i <= 1; i++) {
                const checkPos = pos + i;
                if (checkPos < 0 || checkPos >= state.doc.content.size) continue;

                const node = state.doc.nodeAt(checkPos);
                if (node?.type.name === 'taskMarker') {
                  foundPos = checkPos;
                  foundNode = node;
                  break;
                }
              }

              if (foundPos !== null && foundNode) {
                const currentState = foundNode.attrs.state as string;
                const states = extensionThis.options.states;
                const currentIndex = states.findIndex((s) => s.value === currentState);
                const direction = event.shiftKey ? -1 : 1;
                const nextIndex = (currentIndex + direction + states.length) % states.length;
                const nextState = states[nextIndex].value;

                const tr = state.tr.setNodeMarkup(foundPos, undefined, {
                  ...foundNode.attrs,
                  state: nextState,
                });
                dispatch(tr);
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});

export default TaskMarker;
