/**
 * Editor with Block Menu - Wrapper that adds floating block controls
 */

import React from 'react';
import { Editor, EditorContent } from '@tiptap/react';
import { FloatingBlockMenu } from './FloatingBlockMenu';

export interface EditorWithBlockMenuProps {
  editor: Editor | null;
}

export function EditorWithBlockMenu({ editor }: EditorWithBlockMenuProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="relative">
      {/* Floating Block Menu - positioned absolutely */}
      <div className="absolute left-[-52px] top-0 z-10">
        <FloatingBlockMenu editor={editor} />
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="prose prose-stone dark:prose-invert max-w-none focus-within:outline-hidden"
      />
    </div>
  );
}
