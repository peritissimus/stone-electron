/**
 * Note Editor Content Component
 */
import { forwardRef } from 'react';
import { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { useEditorUI } from '@renderer/hooks/useUI';

export interface NoteEditorContentProps {
  editor: Editor | null;
  isLoading: boolean;
}

const SKELETON_WIDTHS = ['55%', '48%', '62%', '45%', '70%'];

function EditorSkeleton() {
  return (
    <div className="max-w-[900px] mx-auto px-16 py-12 space-y-4">
      {/* First paragraph line */}
      <Skeleton className="h-5 w-48" />

      {/* TODO items skeleton - matches task list layout */}
      <div className="space-y-2 pt-2">
        {SKELETON_WIDTHS.map((width, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5" style={{ width }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const NoteEditorContent = forwardRef<HTMLDivElement, NoteEditorContentProps>(
  function NoteEditorContent({ editor, isLoading }, ref) {
    const { showBlockIndicators } = useEditorUI();

    return (
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto bg-background relative">
        {isLoading ? (
          <EditorSkeleton />
        ) : (
          <div
            className={`max-w-[900px] mx-auto px-16 py-12 ${!showBlockIndicators ? 'hide-block-indicators' : ''}`}
          >
            <EditorContent
              editor={editor}
              className="prose prose-stone dark:prose-invert max-w-none focus-within:outline-hidden min-h-[300px]"
            />
          </div>
        )}
      </div>
    );
  },
);
