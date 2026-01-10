import {
  Command,
  CommandProps,
  KeyboardShortcutCommand,
  Node,
  RawCommands,
  findParentNode,
  mergeAttributes,
  wrappingInputRule,
  InputRule,
} from '@tiptap/core';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    logseqTaskItem: {
      setTaskState: (stateValue: string) => ReturnType;
      cycleTaskState: (direction?: number) => ReturnType;
    };
  }
}

export interface TaskStateOption {
  value: string;
  label: string;
  shortLabel?: string;
  done?: boolean;
}

export interface LogseqTaskItemOptions {
  onReadOnlyChecked?: (node: ProseMirrorNode, nextState: string) => boolean;
  nested: boolean;
  HTMLAttributes: Record<string, any>;
  taskListTypeName: string;
  a11y?: {
    stateLabel?: (node: ProseMirrorNode, state: string) => string;
  };
  states: TaskStateOption[];
  defaultState: string;
  doneStates: string[];
}

const inputRegex = /^\s*(\[([( |x])?\])\s$/;
// Input rule for task items WITHOUT list marker (dash/asterisk)
// Lines starting with "- TODO" should remain as regular list items
const logseqMarkerInputRegex = /^\s*(TODO|DOING|DONE|WAITING|HOLD|CANCELED|CANCELLED|IDEA)\s$/i;

const getStateOption = (options: LogseqTaskItemOptions, value?: string) => {
  if (!value) {
    return (
      options.states.find((state) => state.value === options.defaultState) ?? options.states[0]
    );
  }

  return (
    options.states.find((state) => state.value === value) ??
    options.states.find((state) => state.value === options.defaultState) ??
    options.states[0]
  );
};

const normalizeStateValue = (value: string | undefined) => {
  if (!value) {
    return value;
  }

  if (value.toLowerCase() === 'cancelled') {
    return 'canceled';
  }

  return value.toLowerCase();
};

const isDoneState = (options: LogseqTaskItemOptions, value?: string) => {
  if (!value) {
    return false;
  }

  const option = getStateOption(options, value);

  if (typeof option?.done === 'boolean') {
    return option.done;
  }

  return options.doneStates.includes(option?.value ?? '');
};

const getNextStateValue = (options: LogseqTaskItemOptions, current?: string, direction = 1) => {
  if (!options.states.length) {
    return options.defaultState;
  }

  const currentValue = normalizeStateValue(current) ?? options.defaultState;
  const index = options.states.findIndex((state) => state.value === currentValue);

  if (index === -1) {
    return direction > 0
      ? options.states[0].value
      : options.states[options.states.length - 1].value;
  }

  const nextIndex = (index + direction + options.states.length) % options.states.length;
  return options.states[nextIndex].value;
};

export const LogseqTaskItem = Node.create<LogseqTaskItemOptions>({
  name: 'taskItem',

  addOptions() {
    return {
      nested: false,
      HTMLAttributes: {},
      taskListTypeName: 'taskList',
      a11y: undefined,
      states: [
        { value: 'todo', label: 'TODO' },
        { value: 'doing', label: 'DOING' },
        { value: 'waiting', label: 'WAITING' },
        { value: 'hold', label: 'HOLD' },
        { value: 'done', label: 'DONE', done: true },
        { value: 'canceled', label: 'CANCELED', done: true, shortLabel: 'CAN' },
        { value: 'idea', label: 'IDEA' },
      ],
      defaultState: 'todo',
      doneStates: ['done', 'canceled'],
    } satisfies LogseqTaskItemOptions;
  },

  content() {
    return this.options.nested ? 'paragraph block*' : 'paragraph+';
  },

  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: (element) => {
          const dataChecked = element.dataset.checked;
          return dataChecked === '' || dataChecked === 'true';
        },
        renderHTML: (attributes) => ({
          'data-checked': attributes.checked,
        }),
      },
      state: {
        default: this.options.defaultState,
        keepOnSplit: false,
        parseHTML: (element) =>
          normalizeStateValue(element.dataset.state) ?? this.options.defaultState,
        renderHTML: (attributes) => ({
          'data-state': attributes.state ?? this.options.defaultState,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const option = getStateOption(this.options, node.attrs.state);
    const done = isDoneState(this.options, option?.value);

    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        'data-state': option?.value,
        'data-checked': done,
      }),
      [
        'button',
        {
          type: 'button',
          class: 'task-state-button',
          'data-state': option?.value,
          'aria-label':
            this.options.a11y?.stateLabel?.(node, option?.value ?? this.options.defaultState) ??
            `Task state: ${option?.label ?? option?.value ?? this.options.defaultState}`,
        },
        option?.label ?? option?.value ?? '',
      ],
      ['div', 0],
    ];
  },

  addCommands() {
    const commands = {
      setTaskState:
        (stateValue: string): Command =>
        ({ commands }: CommandProps) =>
          commands.updateAttributes(this.name, {
            state: normalizeStateValue(stateValue) ?? this.options.defaultState,
            checked: isDoneState(this.options, stateValue),
          }),
      cycleTaskState:
        (direction = 1): Command =>
        ({ state, dispatch, tr }: CommandProps) => {
          const parent = findParentNode((node) => node.type.name === this.name)(state.selection);

          if (!parent) {
            return false;
          }

          const nextValue = getNextStateValue(this.options, parent.node.attrs.state, direction);
          const updatedAttrs = {
            ...parent.node.attrs,
            state: nextValue,
            checked: isDoneState(this.options, nextValue),
          };

          dispatch?.(tr.setNodeMarkup(parent.pos, undefined, updatedAttrs));

          return true;
        },
    };

    return commands as Partial<RawCommands>;
  },

  addKeyboardShortcuts() {
    const cycleWithDirection = (direction: number) =>
      this.editor.commands.command(({ state, dispatch, tr }) => {
        const parent = findParentNode((node) => node.type.name === this.name)(state.selection);

        if (!parent) {
          return false;
        }

        const nextValue = getNextStateValue(this.options, parent.node.attrs.state, direction);
        const updatedAttrs = {
          ...parent.node.attrs,
          state: nextValue,
          checked: isDoneState(this.options, nextValue),
        };

        dispatch?.(tr.setNodeMarkup(parent.pos, undefined, updatedAttrs));

        return true;
      });

    const shortcuts: Record<string, KeyboardShortcutCommand> = {
      Enter: () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
      'Mod-Shift-Enter': () => cycleWithDirection(1),
      'Mod-Alt-Shift-Enter': () => cycleWithDirection(-1),
    };

    if (this.options.nested) {
      shortcuts['Tab'] = () => this.editor.commands.sinkListItem(this.name);
    }

    return shortcuts;
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li');
      const stateButton = document.createElement('button');
      const content = document.createElement('div');

      stateButton.type = 'button';
      stateButton.classList.add('task-state-button');
      stateButton.contentEditable = 'false';

      // Store handlers for cleanup
      const handleMouseDown = (event: MouseEvent) => event.preventDefault();

      const applyAttributes = (currentNode: typeof node) => {
        const option = getStateOption(this.options, currentNode.attrs.state);
        const done = isDoneState(this.options, option?.value);

        listItem.dataset.type = this.name;
        listItem.dataset.state = option?.value ?? this.options.defaultState;
        listItem.dataset.checked = done ? 'true' : 'false';

        stateButton.dataset.state = option?.value ?? this.options.defaultState;
        stateButton.textContent = option?.shortLabel ?? option?.label ?? option?.value ?? '';
        stateButton.title = 'Click to cycle state • Shift+Click to go back';
        stateButton.setAttribute(
          'aria-label',
          this.options.a11y?.stateLabel?.(
            currentNode,
            option?.value ?? this.options.defaultState,
          ) ??
            `Task state control (${option?.label ?? option?.value ?? this.options.defaultState})`,
        );
      };

      const updateNodeState = (direction: number) => {
        if (!editor.isEditable || typeof getPos !== 'function') {
          return;
        }

        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .command(({ tr }) => {
            const position = getPos();

            if (typeof position !== 'number') {
              return false;
            }

            const currentNode = tr.doc.nodeAt(position);

            if (!currentNode) {
              return false;
            }

            const nextValue = getNextStateValue(this.options, currentNode.attrs.state, direction);

            tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              state: nextValue,
              checked: isDoneState(this.options, nextValue),
            });

            return true;
          })
          .run();
      };

      const handleClick = (event: MouseEvent) => {
        event.preventDefault();
        const direction = event.shiftKey ? -1 : 1;
        updateNodeState(direction);
      };

      const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        updateNodeState(-1);
      };

      stateButton.addEventListener('mousedown', handleMouseDown);
      stateButton.addEventListener('click', handleClick);
      stateButton.addEventListener('contextmenu', handleContextMenu);

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        if (value == null) {
          return;
        }

        listItem.setAttribute(key, String(value));
      });

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value == null) {
          return;
        }

        listItem.setAttribute(key, String(value));
      });

      applyAttributes(node);

      listItem.append(stateButton, content);

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) {
            return false;
          }

          applyAttributes(updatedNode);

          return true;
        },
        destroy: () => {
          stateButton.removeEventListener('mousedown', handleMouseDown);
          stateButton.removeEventListener('click', handleClick);
          stateButton.removeEventListener('contextmenu', handleContextMenu);
        },
      };
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => ({
          checked: match[match.length - 1] === 'x',
          state: match[match.length - 1] === 'x' ? 'done' : this.options.defaultState,
        }),
      }),
      // Custom input rule for Logseq-style task items
      new InputRule({
        find: logseqMarkerInputRegex,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;

          // match[1] is the state keyword
          const marker = normalizeStateValue(match[1]);
          const option = getStateOption(this.options, marker ?? undefined);
          const stateValue = option?.value ?? this.options.defaultState;
          const isChecked = isDoneState(this.options, stateValue);

          // Get the task list type
          const taskListType = state.schema.nodes[this.options.taskListTypeName];

          if (!taskListType) {
            return null;
          }

          // Delete the matched text (e.g., "TODO ")
          tr.delete(start, end);

          // Create task list with task item
          const taskItem = this.type.create(
            {
              state: stateValue,
              checked: isChecked,
            },
            Fragment.from(state.schema.nodes.paragraph.create()),
          );

          const taskList = taskListType.create(null, taskItem);

          // Replace the current paragraph with the task list
          tr.replaceWith(start, start, taskList);

          // Set cursor inside the task item
          tr.setSelection(TextSelection.near(tr.doc.resolve(start + 2)));
        },
      }),
    ];
  },
});

export default LogseqTaskItem;
