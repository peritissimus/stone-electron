/**
 * Slash Command Menu Component - Notion-like command palette
 */

import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
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
  Clock,
  TreeStructure,
} from 'phosphor-react';
import { CommandMenuItem } from '@renderer/components/composites';

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
      <div
        className="z-50 min-w-[280px] max-h-[400px] overflow-y-auto rounded-xl border border-white/10"
        style={{
          boxShadow: 'var(--shadow-popover)',
          backgroundColor: 'hsl(var(--popover-base) / 0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <div className="p-1">
          {items.map((item, index) => (
            <CommandMenuItem
              key={index}
              icon={item.icon}
              title={item.title}
              description={item.description}
              size="spacious"
              isSelected={index === selectedIndex}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            />
          ))}
        </div>
      </div>
    );
  },
);

SlashCommandMenu.displayName = 'SlashCommandMenu';

// Default slash command items
export const defaultSlashCommands = (_editor: any): SlashCommandItem[] => [
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
    title: 'Flow Diagram',
    description: 'Create a flowchart with simple syntax',
    icon: <TreeStructure size={18} />,
    command: ({ editor, range }: any) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: 'flowdsl' })
        .insertContent(
          `title My Flow Chart
direction down

// Define your nodes
Start [shape: oval, color: lightgreen, icon: play]
Process [color: lightblue]
Decision [shape: diamond, color: yellow]
End [shape: oval, color: gray]

// Define relationships
Start > Process
Process > Decision
Decision > End: Yes
Decision > Process: No`,
        )
        .run();
    },
    searchTerms: ['flow', 'flowchart', 'diagram', 'flowdsl', 'chart', 'graph'],
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
  {
    title: 'Current Time',
    description: 'Insert the current time',
    icon: <Clock size={18} />,
    command: ({ editor, range }: any) => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      editor.chain().focus().deleteRange(range).insertContent(timeString).run();
    },
    searchTerms: ['time', 'clock', 'now'],
  },
];
