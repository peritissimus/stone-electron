/**
 * Floating Block Menu - Notion-like drag handle and add button
 */

import React, { useState } from 'react';
import type { RichTextEditor } from '@renderer/editor';
import {
  Plus,
  DotsSixVertical,
  TextHOne,
  TextHTwo,
  TextHThree,
  List,
  ListNumbers,
  Code,
  Quotes,
  Minus,
  Check,
  TextT,
} from 'phosphor-react';
import { cn } from '@renderer/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { CommandMenuItem } from '@renderer/components/composites';

export interface FloatingBlockMenuProps {
  editor: RichTextEditor;
}

export function FloatingBlockMenu({ editor }: FloatingBlockMenuProps) {
  const [isDragging, setIsDragging] = useState(false);

  const addBlock = (type: string) => {
    const { state } = editor;
    const { selection } = state;
    const pos = selection.$anchor.pos;

    switch (type) {
      case 'paragraph':
        editor.chain().focus().insertContentAt(pos, { type: 'paragraph' }).run();
        break;
      case 'heading1':
        editor
          .chain()
          .focus()
          .insertContentAt(pos, { type: 'heading', attrs: { level: 1 } })
          .run();
        break;
      case 'heading2':
        editor
          .chain()
          .focus()
          .insertContentAt(pos, { type: 'heading', attrs: { level: 2 } })
          .run();
        break;
      case 'heading3':
        editor
          .chain()
          .focus()
          .insertContentAt(pos, { type: 'heading', attrs: { level: 3 } })
          .run();
        break;
      case 'bulletList':
        editor
          .chain()
          .focus()
          .insertContentAt(pos, {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
          })
          .run();
        break;
      case 'orderedList':
        editor
          .chain()
          .focus()
          .insertContentAt(pos, {
            type: 'orderedList',
            content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
          })
          .run();
        break;
      case 'taskList':
        editor
          .chain()
          .focus()
          .insertContentAt(pos, {
            type: 'taskList',
            content: [{ type: 'taskItem', content: [{ type: 'paragraph' }] }],
          })
          .run();
        break;
      case 'codeBlock':
        editor.chain().focus().insertContentAt(pos, { type: 'codeBlock' }).run();
        break;
      case 'blockquote':
        editor
          .chain()
          .focus()
          .insertContentAt(pos, {
            type: 'blockquote',
            content: [{ type: 'paragraph' }],
          })
          .run();
        break;
      case 'divider':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    const { state } = editor;
    const { selection } = state;

    // Store the node position for later
    const pos = selection.$anchor.pos;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Required for Firefox

    // Store position in dataset
    const target = e.currentTarget as HTMLElement;
    target.dataset.dragPos = pos.toString();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity duration-150"
      contentEditable={false}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className={cn(
          'p-1 hover:bg-accent rounded-sm text-muted-foreground transition-colors',
          isDragging ? 'cursor-grabbing bg-accent' : 'cursor-grab',
        )}
        draggable={true}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        title="Drag to move"
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>

      {/* Add Block Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="p-1 hover:bg-accent rounded-sm text-muted-foreground transition-colors"
            title="Add block below"
          >
            <Plus size={16} weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[260px]">
          <DropdownMenuItem onClick={() => addBlock('paragraph')}>
            <CommandMenuItem
              asChild
              icon={<TextT size={18} />}
              title="Text"
              description="Just start writing"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('heading1')}>
            <CommandMenuItem
              asChild
              icon={<TextHOne size={18} />}
              title="Heading 1"
              description="Large section heading"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('heading2')}>
            <CommandMenuItem
              asChild
              icon={<TextHTwo size={18} />}
              title="Heading 2"
              description="Medium section heading"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('heading3')}>
            <CommandMenuItem
              asChild
              icon={<TextHThree size={18} />}
              title="Heading 3"
              description="Small section heading"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('bulletList')}>
            <CommandMenuItem
              asChild
              icon={<List size={18} />}
              title="Bullet List"
              description="Simple bullet list"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('orderedList')}>
            <CommandMenuItem
              asChild
              icon={<ListNumbers size={18} />}
              title="Numbered List"
              description="List with numbering"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('taskList')}>
            <CommandMenuItem
              asChild
              icon={<Check size={18} />}
              title="To-do List"
              description="Track tasks"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('codeBlock')}>
            <CommandMenuItem
              asChild
              icon={<Code size={18} />}
              title="Code Block"
              description="Syntax highlighting"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('blockquote')}>
            <CommandMenuItem
              asChild
              icon={<Quotes size={18} />}
              title="Quote"
              description="Capture a quote"
              size="spacious"
            />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('divider')}>
            <CommandMenuItem
              asChild
              icon={<Minus size={18} />}
              title="Divider"
              description="Visual separator"
              size="spacious"
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
