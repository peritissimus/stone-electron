/**
 * Floating Block Menu - Notion-like drag handle and add button
 */

import React, { useState } from 'react';
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

export interface FloatingBlockMenuProps {
  editor: Editor;
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
    const resolvedPos = state.doc.resolve(pos);
    const node = resolvedPos.node();

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
          <DropdownMenuItem onClick={() => addBlock('paragraph')} className="gap-3 py-2">
            <TextT size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Text</div>
              <div className="text-xs text-muted-foreground">Just start writing</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('heading1')} className="gap-3 py-2">
            <TextHOne size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Heading 1</div>
              <div className="text-xs text-muted-foreground">Large section heading</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('heading2')} className="gap-3 py-2">
            <TextHTwo size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Heading 2</div>
              <div className="text-xs text-muted-foreground">Medium section heading</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('heading3')} className="gap-3 py-2">
            <TextHThree size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Heading 3</div>
              <div className="text-xs text-muted-foreground">Small section heading</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('bulletList')} className="gap-3 py-2">
            <List size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Bullet List</div>
              <div className="text-xs text-muted-foreground">Simple bullet list</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('orderedList')} className="gap-3 py-2">
            <ListNumbers size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Numbered List</div>
              <div className="text-xs text-muted-foreground">List with numbering</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('taskList')} className="gap-3 py-2">
            <Check size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">To-do List</div>
              <div className="text-xs text-muted-foreground">Track tasks</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('codeBlock')} className="gap-3 py-2">
            <Code size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Code Block</div>
              <div className="text-xs text-muted-foreground">Syntax highlighting</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('blockquote')} className="gap-3 py-2">
            <Quotes size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Quote</div>
              <div className="text-xs text-muted-foreground">Capture a quote</div>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => addBlock('divider')} className="gap-3 py-2">
            <Minus size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Divider</div>
              <div className="text-xs text-muted-foreground">Visual separator</div>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
