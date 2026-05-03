/**
 * Editor Toolbar Component
 *
 * Uses config-driven rendering to reduce JSX verbosity.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { RichTextEditor } from '@renderer/editor';
import { cn } from '@renderer/lib/utils';
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  Code,
  HighlighterCircle,
  Image,
  Link,
  List,
  ListNumbers,
  Minus,
  Quotes,
  TextBolder,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
  ArrowLineUp,
  ArrowLineDown,
  ArrowLineLeft,
  ArrowLineRight,
  Trash,
  Table as TableIcon,
  Icon,
} from 'phosphor-react';
import { ToolbarButton, ToolbarDivider } from '@renderer/components/composites';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/base/ui/select';
import { UrlInsertPopover } from './UrlInsertPopover';

export interface EditorToolbarProps {
  editor: RichTextEditor | null;
  className?: string;
}

/** Supported programming languages for code blocks */
const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'php', label: 'PHP' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid (Diagram)' },
  { value: 'plaintext', label: 'Plain Text' },
] as const;

/** Toolbar button configuration */
interface ToolbarButtonConfig {
  cmd: string;
  icon: Icon;
  tooltip: string;
  active?: string | { name: string; attrs?: Record<string, unknown> };
  canCheck?: string;
}

interface ToolbarGroup {
  id: string;
  buttons: ToolbarButtonConfig[];
}

const TOOLBAR_GROUPS: ToolbarGroup[] = [
  {
    id: 'history',
    buttons: [
      { cmd: 'undo', icon: ArrowCounterClockwise, tooltip: 'Undo (Ctrl+Z)', canCheck: 'undo' },
      { cmd: 'redo', icon: ArrowClockwise, tooltip: 'Redo (Ctrl+Y)', canCheck: 'redo' },
    ],
  },
  {
    id: 'formatting',
    buttons: [
      { cmd: 'toggleBold', icon: TextBolder, tooltip: 'Bold (Ctrl+B)', active: 'bold' },
      { cmd: 'toggleItalic', icon: TextItalic, tooltip: 'Italic (Ctrl+I)', active: 'italic' },
      { cmd: 'toggleStrike', icon: TextStrikethrough, tooltip: 'Strikethrough', active: 'strike' },
      { cmd: 'toggleCode', icon: Code, tooltip: 'Inline Code', active: 'code' },
      {
        cmd: 'toggleHighlight',
        icon: HighlighterCircle,
        tooltip: 'Highlight',
        active: 'highlight',
      },
    ],
  },
  {
    id: 'headings',
    buttons: [
      {
        cmd: 'toggleH1',
        icon: TextHOne,
        tooltip: 'Heading 1 (Ctrl+Alt+1)',
        active: { name: 'heading', attrs: { level: 1 } },
      },
      {
        cmd: 'toggleH2',
        icon: TextHTwo,
        tooltip: 'Heading 2 (Ctrl+Alt+2)',
        active: { name: 'heading', attrs: { level: 2 } },
      },
      {
        cmd: 'toggleH3',
        icon: TextHThree,
        tooltip: 'Heading 3 (Ctrl+Alt+3)',
        active: { name: 'heading', attrs: { level: 3 } },
      },
    ],
  },
  {
    id: 'lists',
    buttons: [
      { cmd: 'toggleBulletList', icon: List, tooltip: 'Bullet List', active: 'bulletList' },
      {
        cmd: 'toggleOrderedList',
        icon: ListNumbers,
        tooltip: 'Numbered List',
        active: 'orderedList',
      },
    ],
  },
  {
    id: 'blocks',
    buttons: [
      { cmd: 'toggleBlockquote', icon: Quotes, tooltip: 'Blockquote', active: 'blockquote' },
      { cmd: 'setHorizontalRule', icon: Minus, tooltip: 'Horizontal Rule' },
    ],
  },
];

const TABLE_BUTTONS: ToolbarButtonConfig[] = [
  { cmd: 'addRowBefore', icon: ArrowLineUp, tooltip: 'Insert row above', canCheck: 'addRowBefore' },
  { cmd: 'addRowAfter', icon: ArrowLineDown, tooltip: 'Insert row below', canCheck: 'addRowAfter' },
  {
    cmd: 'addColumnBefore',
    icon: ArrowLineLeft,
    tooltip: 'Insert column before',
    canCheck: 'addColumnBefore',
  },
  {
    cmd: 'addColumnAfter',
    icon: ArrowLineRight,
    tooltip: 'Insert column after',
    canCheck: 'addColumnAfter',
  },
  { cmd: 'deleteRow', icon: Trash, tooltip: 'Delete row', canCheck: 'deleteRow' },
  { cmd: 'deleteColumn', icon: Trash, tooltip: 'Delete column', canCheck: 'deleteColumn' },
];

/**
 * Hook that creates memoized editor command handlers.
 */
function useEditorCommands(editor: RichTextEditor | null) {
  return useMemo(() => {
    const toggle = (command: string) => () => {
      (editor?.chain().focus() as any)[command]?.().run();
    };

    const run = (command: string, args?: any) => () => {
      (editor?.chain().focus() as any)[command]?.(args).run();
    };

    return {
      undo: toggle('undo'),
      redo: toggle('redo'),
      toggleBold: toggle('toggleBold'),
      toggleItalic: toggle('toggleItalic'),
      toggleStrike: toggle('toggleStrike'),
      toggleCode: toggle('toggleCode'),
      toggleHighlight: toggle('toggleHighlight'),
      toggleH1: run('toggleHeading', { level: 1 }),
      toggleH2: run('toggleHeading', { level: 2 }),
      toggleH3: run('toggleHeading', { level: 3 }),
      toggleBulletList: toggle('toggleBulletList'),
      toggleOrderedList: toggle('toggleOrderedList'),
      toggleBlockquote: toggle('toggleBlockquote'),
      setHorizontalRule: toggle('setHorizontalRule'),
      toggleCodeBlock: toggle('toggleCodeBlock'),
      insertTable: run('insertTable', { rows: 3, cols: 3, withHeaderRow: true }),
      addRowBefore: toggle('addRowBefore'),
      addRowAfter: toggle('addRowAfter'),
      addColumnBefore: toggle('addColumnBefore'),
      addColumnAfter: toggle('addColumnAfter'),
      deleteRow: toggle('deleteRow'),
      deleteColumn: toggle('deleteColumn'),
    };
  }, [editor]);
}

/**
 * Hook for code block language synchronization.
 */
function useCodeBlockLanguage(editor: RichTextEditor | null) {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');

  useEffect(() => {
    if (!editor) return;

    const updateLanguage = () => {
      if (editor.isActive('codeBlock')) {
        const attrs = editor.getAttributes('codeBlock');
        setSelectedLanguage(attrs.language || 'plaintext');
      }
    };

    editor.on('selectionUpdate', updateLanguage);
    editor.on('update', updateLanguage);
    updateLanguage();

    return () => {
      editor.off('selectionUpdate', updateLanguage);
      editor.off('update', updateLanguage);
    };
  }, [editor]);

  const handleLanguageChange = useCallback(
    (language: string) => {
      setSelectedLanguage(language);
      if (editor?.isActive('codeBlock')) {
        editor.commands.updateAttributes('codeBlock', { language });
      }
    },
    [editor],
  );

  const handleCodeBlockInsert = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleCodeBlock().run();
    if (editor.isActive('codeBlock')) {
      editor.commands.updateAttributes('codeBlock', { language: selectedLanguage });
    }
  }, [editor, selectedLanguage]);

  return { selectedLanguage, handleLanguageChange, handleCodeBlockInsert };
}

export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  const cmd = useEditorCommands(editor);
  const { selectedLanguage, handleLanguageChange, handleCodeBlockInsert } =
    useCodeBlockLanguage(editor);

  if (!editor) return null;

  const isInTable =
    editor.isActive('table') || editor.isActive('tableRow') || editor.isActive('tableCell');

  const isButtonActive = (config: ToolbarButtonConfig): boolean => {
    if (!config.active) return false;
    if (typeof config.active === 'string') {
      return editor.isActive(config.active);
    }
    return editor.isActive(config.active.name, config.active.attrs);
  };

  const isButtonDisabled = (config: ToolbarButtonConfig): boolean => {
    if (!config.canCheck) return false;
    const can = editor.can();
    const checkFn = (can as any)[config.canCheck];
    return checkFn ? !checkFn.call(can) : false;
  };

  return (
    <div
      className={cn(
        'bg-background/95 backdrop-blur-xs px-3 py-2 flex items-center gap-1 flex-wrap border-b border-border/50',
        className,
      )}
    >
      {/* Standard toolbar groups */}
      {TOOLBAR_GROUPS.map((group, groupIndex) => (
        <React.Fragment key={group.id}>
          <div className="flex items-center gap-0.5 mr-2">
            {group.buttons.map((btn) => {
              const IconComponent = btn.icon;
              return (
                <ToolbarButton
                  key={btn.cmd}
                  size="compact"
                  onClick={cmd[btn.cmd as keyof typeof cmd]}
                  active={isButtonActive(btn)}
                  disabled={isButtonDisabled(btn)}
                  tooltip={btn.tooltip}
                >
                  <IconComponent size={14} />
                </ToolbarButton>
              );
            })}
          </div>
          {groupIndex < TOOLBAR_GROUPS.length - 1 && <ToolbarDivider size="sm" />}
        </React.Fragment>
      ))}

      {/* Code block with language selector */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={handleCodeBlockInsert}
          active={editor.isActive('codeBlock')}
          tooltip="Code Block"
        >
          <Code size={14} />
        </ToolbarButton>
        {editor.isActive('codeBlock') && (
          <Select value={selectedLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="h-6 w-[110px] text-xs border-border/60 bg-background/50">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {CODE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value} className="text-xs">
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table operations (conditional) */}
      {isInTable && (
        <>
          <ToolbarDivider size="sm" />
          <div className="flex items-center gap-0.5 mr-2">
            {TABLE_BUTTONS.map((btn) => {
              const IconComponent = btn.icon;
              return (
                <ToolbarButton
                  key={btn.cmd}
                  size="compact"
                  onClick={cmd[btn.cmd as keyof typeof cmd]}
                  disabled={isButtonDisabled(btn)}
                  tooltip={btn.tooltip}
                >
                  <IconComponent size={14} />
                </ToolbarButton>
              );
            })}
          </div>
        </>
      )}

      <ToolbarDivider />

      {/* Insert group */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton size="compact" onClick={cmd.insertTable} tooltip="Insert Table (3x3)">
          <TableIcon size={14} />
        </ToolbarButton>
        <UrlInsertPopover
          editor={editor}
          type="link"
          icon={<Link size={14} />}
          tooltip="Insert Link"
        />
        <UrlInsertPopover
          editor={editor}
          type="image"
          icon={<Image size={14} />}
          tooltip="Insert Image"
        />
      </div>
    </div>
  );
}
