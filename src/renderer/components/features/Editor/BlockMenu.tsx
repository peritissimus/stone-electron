/**
 * Block Menu Component - Notion-like floating block options
 */

import React from 'react';
import { Editor } from '@tiptap/react';
import { Plus, DotsSixVertical } from 'phosphor-react';
import { cn } from '@renderer/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
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
  TextT,
} from 'phosphor-react';

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
          <DropdownMenuItem onClick={() => addBlock('paragraph')} className="gap-3">
            <TextT size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Text</div>
              <div className="text-xs text-muted-foreground">Just start writing</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('heading1')} className="gap-3">
            <TextHOne size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Heading 1</div>
              <div className="text-xs text-muted-foreground">Large section heading</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('heading2')} className="gap-3">
            <TextHTwo size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Heading 2</div>
              <div className="text-xs text-muted-foreground">Medium section heading</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('heading3')} className="gap-3">
            <TextHThree size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Heading 3</div>
              <div className="text-xs text-muted-foreground">Small section heading</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('bulletList')} className="gap-3">
            <List size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Bullet List</div>
              <div className="text-xs text-muted-foreground">Simple bullet list</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('orderedList')} className="gap-3">
            <ListNumbers size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Numbered List</div>
              <div className="text-xs text-muted-foreground">List with numbering</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('taskList')} className="gap-3">
            <Check size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">To-do List</div>
              <div className="text-xs text-muted-foreground">Track tasks</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('codeBlock')} className="gap-3">
            <Code size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Code Block</div>
              <div className="text-xs text-muted-foreground">Syntax highlighting</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('blockquote')} className="gap-3">
            <Quotes size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Quote</div>
              <div className="text-xs text-muted-foreground">Capture a quote</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('divider')} className="gap-3">
            <Minus size={16} className="text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Divider</div>
              <div className="text-xs text-muted-foreground">Visual separator</div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
