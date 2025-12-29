/**
 * Slash Command Extension - Notion-like slash commands
 */

import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import tippy, { Instance as TippyInstance } from 'tippy.js';

// Unique plugin key for slash command suggestion
const slashCommandPluginKey = new PluginKey('slashCommand');
import {
  SlashCommandMenu,
  SlashCommandMenuRef,
  defaultSlashCommands,
} from '../components/features/Editor/SlashCommandMenu';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: slashCommandPluginKey,
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: any) => {
          const commands = defaultSlashCommands(this.editor);

          if (!query) {
            return commands;
          }

          const searchQuery = query.toLowerCase();
          return commands.filter((item) => {
            const titleMatch = item.title.toLowerCase().includes(searchQuery);
            const descMatch = item.description.toLowerCase().includes(searchQuery);
            const searchTermsMatch = item.searchTerms?.some((term) =>
              term.toLowerCase().includes(searchQuery),
            );
            return titleMatch || descMatch || searchTermsMatch;
          });
        },
        render: () => {
          let component: ReactRenderer<SlashCommandMenuRef>;
          let popup: TippyInstance[];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                maxWidth: 'none',
                offset: [0, 8],
                theme: 'slash-command',
              });
            },

            onUpdate(props: any) {
              component.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            onKeyDown(props: any) {
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }

              return component.ref?.onKeyDown(props) || false;
            },

            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});
