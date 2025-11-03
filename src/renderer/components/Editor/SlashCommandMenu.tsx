/**
 * Slash Command Menu Component - Notion-like command palette
 */

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@renderer/lib/utils';
import {
  TextHOne,
  TextHTwo,
  TextHThree,
  List,
  ListNumbers,
  Code,
  Quotes,
  Minus,
  Check,
} from 'phosphor-react';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: any) => void;
  searchTerms?: string[];
}

export interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return null;
    }

    return (
      <div className="z-50 min-w-[280px] max-h-[400px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
        <div className="p-1">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-left transition-colors',
                'hover:bg-accent cursor-pointer',
                index === selectedIndex && 'bg-accent',
              )}
            >
              <div className="flex-shrink-0 mt-0.5 text-muted-foreground">{item.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {item.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  },
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

// Default slash command items
export const defaultSlashCommands = (editor: any): SlashCommandItem[] => [
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: <TextHOne size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
    searchTerms: ['h1', 'heading', 'title'],
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <TextHTwo size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
    searchTerms: ['h2', 'heading', 'subtitle'],
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <TextHThree size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
    searchTerms: ['h3', 'heading', 'subheading'],
  },
  {
    title: 'Bullet List',
    description: 'Create a simple bullet list',
    icon: <List size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
    searchTerms: ['ul', 'list', 'bullet', 'unordered'],
  },
  {
    title: 'Numbered List',
    description: 'Create a list with numbering',
    icon: <ListNumbers size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
    searchTerms: ['ol', 'list', 'number', 'ordered'],
  },
  {
    title: 'To-do List',
    description: 'Track tasks with a checklist',
    icon: <Check size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
    searchTerms: ['todo', 'task', 'checklist', 'check'],
  },
  {
    title: 'Code Block',
    description: 'Display code with syntax highlighting',
    icon: <Code size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
    searchTerms: ['code', 'codeblock', 'snippet'],
  },
  {
    title: 'Quote',
    description: 'Capture a quote or reference',
    icon: <Quotes size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
    searchTerms: ['blockquote', 'quote', 'citation'],
  },
  {
    title: 'Divider',
    description: 'Visually divide blocks',
    icon: <Minus size={18} />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
    searchTerms: ['hr', 'horizontal', 'rule', 'divider', 'separator'],
  },
];
