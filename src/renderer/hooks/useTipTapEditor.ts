/**
 * TipTap Editor Hook - Configures and manages the TipTap editor instance
 */

import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { ImageWithMenu } from '@renderer/lib/extensions/ImageWithMenu';
import TaskList from '@tiptap/extension-task-list';
import LogseqTaskItem from '@renderer/lib/extensions/LogseqTaskItem';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { lowlight } from 'lowlight';
import { CodeBlockWithMermaid } from '@renderer/lib/extensions/CodeBlockWithMermaid';

// Import slash command extension
import { SlashCommand } from '@renderer/lib/extensions/SlashCommand';
import { NoteLink } from '@renderer/lib/extensions/NoteLink';
import { Timestamp } from '@renderer/lib/extensions/Timestamp';
import { TaskMarker } from '@renderer/lib/extensions/TaskMarker';
import { IndentableBlock } from '@renderer/lib/extensions/IndentableBlock';
import { SearchAndReplace } from '@renderer/lib/extensions/SearchAndReplace';
import { MarkdownPaste } from '@renderer/lib/extensions/MarkdownPaste';
import { TableNavigation } from '@renderer/lib/extensions/TableNavigation';
import { BlockDragDrop } from '@renderer/lib/extensions/BlockDragDrop';
import { useNoteCache } from '@renderer/hooks/useNoteCache';
import { logger } from '@renderer/lib/logger';

// Lazy load languages on demand (saves ~150KB from initial bundle!)
// Language loader map for dynamic imports
const languageLoaders: Record<string, () => Promise<any>> = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  js: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  ts: () => import('highlight.js/lib/languages/typescript'),
  python: () => import('highlight.js/lib/languages/python'),
  py: () => import('highlight.js/lib/languages/python'),
  java: () => import('highlight.js/lib/languages/java'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  'c++': () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  cs: () => import('highlight.js/lib/languages/csharp'),
  go: () => import('highlight.js/lib/languages/go'),
  rust: () => import('highlight.js/lib/languages/rust'),
  rs: () => import('highlight.js/lib/languages/rust'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rb: () => import('highlight.js/lib/languages/ruby'),
  php: () => import('highlight.js/lib/languages/php'),
  swift: () => import('highlight.js/lib/languages/swift'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  kt: () => import('highlight.js/lib/languages/kotlin'),
  sql: () => import('highlight.js/lib/languages/sql'),
  bash: () => import('highlight.js/lib/languages/bash'),
  sh: () => import('highlight.js/lib/languages/bash'),
  shell: () => import('highlight.js/lib/languages/bash'),
  json: () => import('highlight.js/lib/languages/json'),
  xml: () => import('highlight.js/lib/languages/xml'),
  html: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  md: () => import('highlight.js/lib/languages/markdown'),
};

// Track loaded languages to avoid redundant loads
const loadedLanguages = new Set<string>();

// Load language on demand
export const loadLanguage = async (language: string) => {
  if (!language || loadedLanguages.has(language)) {
    return; // Already loaded
  }

  const loader = languageLoaders[language.toLowerCase()];
  if (loader) {
    try {
      const languageModule = await loader();
      lowlight.registerLanguage(language.toLowerCase(), languageModule.default);
      loadedLanguages.add(language);
    } catch (error) {
      logger.warn(`Failed to load language: ${language}`, error);
    }
  }
};

// Pre-load common languages (JavaScript, TypeScript, JSON) for better UX
const preloadCommonLanguages = async () => {
  await Promise.all([loadLanguage('javascript'), loadLanguage('typescript'), loadLanguage('json')]);
};

// Start preloading common languages immediately
preloadCommonLanguages();

// Note: 'mermaid' language is handled by CodeBlockWithMermaid extension
// which auto-renders diagrams when language is set to 'mermaid'

export function useTipTapEditor() {
  const { fetchNotesForAutocomplete } = useNoteCache();

  const editor = useEditor({
    // Prevent flushSync warning in React 18 Strict Mode
    // This defers rendering until after the initial React render cycle
    immediatelyRender: false,
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
      ImageWithMenu.configure({
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
      }),
      SlashCommand,
      NoteLink.configure({
        fetchNotes: fetchNotesForAutocomplete,
        HTMLAttributes: {
          class: 'note-link',
        },
      }),
      IndentableBlock.configure({
        types: ['paragraph', 'heading'],
        maxIndent: 8,
      }),
      SearchAndReplace.configure({
        highlightClass: 'search-highlight',
        activeHighlightClass: 'search-highlight-active',
      }),
      Timestamp,
      TaskMarker,
      MarkdownPaste,
      TableNavigation,
      BlockDragDrop,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-stone dark:prose-invert max-w-none focus:outline-hidden min-h-[400px]',
      },
    },
  });

  return editor;
}
