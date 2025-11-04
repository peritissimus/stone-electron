/**
 * TipTap Editor Hook - Configures and manages the TipTap editor instance
 */

import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import LogseqTaskItem from '@renderer/extensions/LogseqTaskItem';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { lowlight } from 'lowlight';
import { CodeBlockWithMermaid } from '@renderer/extensions/CodeBlockWithMermaid';

// Import common languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';

// Import slash command extension
import { SlashCommand } from '@renderer/extensions/SlashCommand';

// Register languages with lowlight
lowlight.registerLanguage('javascript', javascript);
lowlight.registerLanguage('js', javascript);
lowlight.registerLanguage('typescript', typescript);
lowlight.registerLanguage('ts', typescript);
lowlight.registerLanguage('python', python);
lowlight.registerLanguage('py', python);
lowlight.registerLanguage('java', java);
lowlight.registerLanguage('cpp', cpp);
lowlight.registerLanguage('c++', cpp);
lowlight.registerLanguage('csharp', csharp);
lowlight.registerLanguage('cs', csharp);
lowlight.registerLanguage('go', go);
lowlight.registerLanguage('rust', rust);
lowlight.registerLanguage('rs', rust);
lowlight.registerLanguage('ruby', ruby);
lowlight.registerLanguage('rb', ruby);
lowlight.registerLanguage('php', php);
lowlight.registerLanguage('swift', swift);
lowlight.registerLanguage('kotlin', kotlin);
lowlight.registerLanguage('kt', kotlin);
lowlight.registerLanguage('sql', sql);
lowlight.registerLanguage('bash', bash);
lowlight.registerLanguage('sh', bash);
lowlight.registerLanguage('shell', bash);
lowlight.registerLanguage('json', json);
lowlight.registerLanguage('xml', xml);
lowlight.registerLanguage('html', xml);
lowlight.registerLanguage('css', css);
lowlight.registerLanguage('markdown', markdown);
lowlight.registerLanguage('md', markdown);

// Note: 'mermaid' language is handled by CodeBlockWithMermaid extension
// which auto-renders diagrams when language is set to 'mermaid'

export function useTipTapEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false, // Disable default code block to use CodeBlockWithMermaid
      }),
      CodeBlockWithMermaid.configure({
        lowlight,
        HTMLAttributes: {
          class: 'code-block-wrapper',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline hover:text-primary/80 cursor-pointer' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-lg shadow-sm' },
      }),
      Highlight.configure({
        HTMLAttributes: { class: 'highlight-mark' },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      LogseqTaskItem.configure({
        HTMLAttributes: {
          class: 'task-item',
        },
        nested: true,
        states: [
          { value: 'todo', label: 'TODO' },
          { value: 'doing', label: 'DOING' },
          { value: 'waiting', label: 'WAIT', shortLabel: 'WAIT' },
          { value: 'hold', label: 'HOLD' },
          { value: 'done', label: 'DONE', done: true },
          { value: 'canceled', label: 'CANCELED', done: true, shortLabel: 'CAN' },
          { value: 'idea', label: 'IDEA' },
        ],
        defaultState: 'todo',
        doneStates: ['done', 'canceled'],
      }),
      Table.configure({
        resizable: false,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class: 'stone-table',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'stone-table-header',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'stone-table-cell',
        },
      }),
      Placeholder.configure({
        placeholder: 'Type / for commands, or start writing...',
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
        includeChildren: true,
      }),
      SlashCommand,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
    },
  });

  return editor;
}
