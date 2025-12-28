/**
 * Note Editor Content Component
 */
import { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import { Skeleton } from '@renderer/components/base/ui/skeleton';

export interface NoteEditorContentProps {
  editor: Editor | null;
  isLoading: boolean;
}

function EditorSkeleton() {
  return (
    <div className="max-w-[900px] mx-auto px-16 py-12 space-y-6">
      {/* Title skeleton */}
      <Skeleton className="h-8 w-2/3" />

      {/* Paragraph skeletons */}
      <div className="space-y-3 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[95%]" />
      </div>

      {/* Another paragraph */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[70%]" />
      </div>

      {/* Heading skeleton */}
      <Skeleton className="h-6 w-1/3 mt-8" />

      {/* More paragraph lines */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[88%]" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[60%]" />
      </div>
    </div>
  );
}

export function NoteEditorContent({ editor, isLoading }: NoteEditorContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background relative">
      {isLoading ? (
        <EditorSkeleton />
      ) : (
        <div className="max-w-[900px] mx-auto px-16 py-12">
          <EditorContent
            editor={editor}
            className="prose prose-stone dark:prose-invert max-w-none focus-within:outline-hidden min-h-[300px]"
          />
        </div>
      )}
    </div>
  );
}
