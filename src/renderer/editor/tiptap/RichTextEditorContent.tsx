import { EditorContent } from '@tiptap/react';
import type { RichTextEditor } from '../types';

interface RichTextEditorContentProps {
  editor: RichTextEditor | null;
  className?: string;
}

export function RichTextEditorContent({ editor, className }: RichTextEditorContentProps) {
  return <EditorContent editor={editor} className={className} />;
}
