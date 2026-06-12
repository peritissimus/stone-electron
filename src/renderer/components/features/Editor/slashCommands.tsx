/**
 * Default slash command items for the editor's "/" menu
 */

import type { ReactNode } from 'react';
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
} from '@phosphor-icons/react';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: ReactNode;
  command: (props: any) => void;
  searchTerms?: string[];
}

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
      editor.chain().focus().deleteRange(range).insertCurrentTime().run();
    },
    searchTerms: ['time', 'clock', 'now', 'timestamp'],
  },
];
