/**
 * Editor Toolbar Component
 */

import React from 'react';
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
} from 'phosphor-react';
import { ToolbarButton, ToolbarDivider } from '@renderer/components/composites';

export interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

export function EditorToolbar({ editor, className }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div
      className={cn(
        'bg-card/60 px-2 py-1 flex items-center gap-1 flex-wrap border border-border/60 rounded-md shadow-none',
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
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          tooltip="Code Block"
        >
          <Code size={14} />
        </ToolbarButton>
        <ToolbarButton
          size="compact"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          tooltip="Horizontal Rule"
        >
          <Minus size={14} />
        </ToolbarButton>
      </div>

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
