/**
 * Editor Toolbar Component
 */

import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
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
  CaretDown,
  ArrowLineUp,
  ArrowLineDown,
  ArrowLineLeft,
  ArrowLineRight,
  Trash,
} from 'phosphor-react';
import { ToolbarButton, ToolbarDivider } from '@renderer/components/composites';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';

export interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

const LANGUAGES = [
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
  { value: 'plaintext', label: 'Plain Text' },
];

export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');

  if (!editor) return null;

  const handleCodeBlockInsert = () => {
    editor.chain().focus().toggleCodeBlock().run();
    // Set the language attribute after creating the code block
    if (editor.isActive('codeBlock')) {
      editor.commands.updateAttributes('codeBlock', { language: selectedLanguage });
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    // If currently in a code block, update its language
    if (editor.isActive('codeBlock')) {
      editor.commands.updateAttributes('codeBlock', { language });
    }
  };

  const isInTable =
    editor.isActive('table') || editor.isActive('tableRow') || editor.isActive('tableCell');

  return (
    <div
      className={cn(
        'bg-background/95 backdrop-blur-sm px-3 py-2 flex items-center gap-1 flex-wrap border-b border-border/50',
        className,
      )}
    >
      {/* History Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          tooltip="Undo (Ctrl+Z)"
        >
          <ArrowCounterClockwise size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          tooltip="Redo (Ctrl+Y)"
        >
          <ArrowClockwise size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Text Formatting Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          tooltip="Bold (Ctrl+B)"
        >
          <TextBolder size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          tooltip="Italic (Ctrl+I)"
        >
          <TextItalic size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          tooltip="Strikethrough"
        >
          <TextStrikethrough size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          tooltip="Inline Code"
        >
          <Code size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          tooltip="Highlight"
        >
          <HighlighterCircle size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Headings Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          tooltip="Heading 1 (Ctrl+Alt+1)"
        >
          <TextHOne size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          tooltip="Heading 2 (Ctrl+Alt+2)"
        >
          <TextHTwo size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          tooltip="Heading 3 (Ctrl+Alt+3)"
        >
          <TextHThree size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Lists Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          tooltip="Bullet List"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          tooltip="Numbered List"
        >
          <ListNumbers size={14} />
        </ToolbarButton>
      </div>

      <ToolbarDivider size="sm" />

      {/* Blocks Group */}
      <div className="flex items-center gap-0.5 mr-2">
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          tooltip="Blockquote"
        >
          <Quotes size={14} />
        </ToolbarButton>
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
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value} className="text-xs">
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          tooltip="Horizontal Rule"
        >
          <Minus size={14} />
        </ToolbarButton>
      </div>

      {isInTable && (
        <>
          <ToolbarDivider size="sm" />
          <div className="flex items-center gap-0.5 mr-2">
            <ToolbarButton
              size="compact"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              disabled={!editor.can().chain().focus().addRowBefore().run()}
              tooltip="Insert row above"
            >
              <ArrowLineUp size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              disabled={!editor.can().chain().focus().addRowAfter().run()}
              tooltip="Insert row below"
            >
              <ArrowLineDown size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              disabled={!editor.can().chain().focus().addColumnBefore().run()}
              tooltip="Insert column before"
            >
              <ArrowLineLeft size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              disabled={!editor.can().chain().focus().addColumnAfter().run()}
              tooltip="Insert column after"
            >
              <ArrowLineRight size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={() => editor.chain().focus().deleteRow().run()}
              disabled={!editor.can().chain().focus().deleteRow().run()}
              tooltip="Delete row"
            >
              <Trash size={14} />
            </ToolbarButton>
            <ToolbarButton
              size="compact"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              disabled={!editor.can().chain().focus().deleteColumn().run()}
              tooltip="Delete column"
            >
              <Trash size={14} />
            </ToolbarButton>
          </div>
        </>
      )}

      <ToolbarDivider />

      {/* Insert Group */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          size="compact"
          onClick={() => {
            const url = window.prompt('Enter URL');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          active={editor.isActive('link')}
          tooltip="Insert Link"
        >
          <Link size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => {
            const url = window.prompt('Enter image URL');
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          }}
          tooltip="Insert Image"
        >
          <Image size={14} />
        </ToolbarButton>
      </div>
    </div>
  );
}
