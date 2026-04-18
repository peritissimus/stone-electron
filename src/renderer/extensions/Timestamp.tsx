/**
 * Timestamp Extension - [HH:MM] formatting
 *
 * This extension provides:
 * 1. A custom node type for [HH:MM] timestamps
 * 2. Automatic detection when typing timestamps
 * 3. Styled badge display via CSS
 */

import { Node, mergeAttributes, InputRule } from '@tiptap/core';

export interface TimestampOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    timestamp: {
      /**
       * Insert a timestamp
       */
      insertTimestamp: (time: string) => ReturnType;
      /**
       * Insert current time
       */
      insertCurrentTime: () => ReturnType;
    };
  }
}

// Regex to match [HH:MM] pattern (00:00 to 23:59)
const TIMESTAMP_INPUT_REGEX = /\[([01]?[0-9]|2[0-3]):([0-5][0-9])\]$/;

export const Timestamp = Node.create<TimestampOptions>({
  name: 'timestamp',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      time: {
        default: '00:00',
        parseHTML: (element) => element.dataset.time || element.textContent?.replace(/[\[\]]/g, ''),
        renderHTML: (attributes) => ({
          'data-time': attributes.time,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="timestamp"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'timestamp',
        class: 'timestamp-badge',
      }),
      node.attrs.time,
    ];
  },

  addCommands() {
    return {
      insertTimestamp:
        (time: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { time },
          });
        },
      insertCurrentTime:
        () =>
        ({ commands }) => {
          const now = new Date();
          const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          return commands.insertContent({
            type: this.name,
            attrs: { time },
          });
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: TIMESTAMP_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const hours = match[1].padStart(2, '0');
          const minutes = match[2];
          const time = `${hours}:${minutes}`;

          const { tr } = state;
          const start = range.from;
          const end = range.to;

          tr.replaceWith(start, end, this.type.create({ time }));
        },
      }),
    ];
  },
});

export default Timestamp;
