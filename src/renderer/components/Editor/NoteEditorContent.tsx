/**
 * Note Editor Content Component
 */
import { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import { Spinner } from 'phosphor-react';

export interface NoteEditorContentProps {
  editor: Editor | null;
  isLoading: boolean;
}

export function NoteEditorContent({ editor, isLoading }: NoteEditorContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-card border shadow-sm">
            <Spinner size={16} className="animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading note...</span>
          </div>
        </div>
      )}
      <div className="max-w-[800px] mx-auto px-8 py-6">
        <div className="min-h-[calc(100vh-150px)]">
          <EditorContent
            editor={editor}
            className="prose prose-stone dark:prose-invert max-w-none focus-within:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
