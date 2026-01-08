/**
 * Block Menu Component - Notion-like floating block options
 */

import React from 'react';
import { Editor } from '@tiptap/react';
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

export interface BlockMenuProps {
  editor: Editor;
  className?: string;
}

export function BlockMenu({ editor, className }: BlockMenuProps) {
  const addBlock = (type: string) => {
    switch (type) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'heading1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'heading2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'heading3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'taskList':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'divider':
        editor.chain().focus().setHorizontalRule().run();
        break;
    }
  };

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {/* Drag Handle */}
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded-sm text-muted-foreground"
        contentEditable={false}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <DotsSixVertical size={16} weight="bold" />
      </button>

      {/* Add Block Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded-sm text-muted-foreground"
            contentEditable={false}
          >
            <Plus size={16} weight="bold" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          <DropdownMenuItem onClick={() => addBlock('paragraph')}>
            <CommandMenuItem asChild icon={<TextT size={16} />} title="Text" description="Just start writing" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('heading1')}>
            <CommandMenuItem asChild icon={<TextHOne size={16} />} title="Heading 1" description="Large section heading" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('heading2')}>
            <CommandMenuItem asChild icon={<TextHTwo size={16} />} title="Heading 2" description="Medium section heading" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('heading3')}>
            <CommandMenuItem asChild icon={<TextHThree size={16} />} title="Heading 3" description="Small section heading" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('bulletList')}>
            <CommandMenuItem asChild icon={<List size={16} />} title="Bullet List" description="Simple bullet list" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('orderedList')}>
            <CommandMenuItem asChild icon={<ListNumbers size={16} />} title="Numbered List" description="List with numbering" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('taskList')}>
            <CommandMenuItem asChild icon={<Check size={16} />} title="To-do List" description="Track tasks" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('codeBlock')}>
            <CommandMenuItem asChild icon={<Code size={16} />} title="Code Block" description="Syntax highlighting" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('blockquote')}>
            <CommandMenuItem asChild icon={<Quotes size={16} />} title="Quote" description="Capture a quote" />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => addBlock('divider')}>
            <CommandMenuItem asChild icon={<Minus size={16} />} title="Divider" description="Visual separator" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
