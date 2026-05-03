/**
 * Note Editor Content Component
 */
import { forwardRef } from 'react';
import { RichTextEditorContent, type RichTextEditor } from '@renderer/editor';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import { useEditorUI } from '@renderer/hooks/useUI';
import { useEditorConfig } from '@renderer/hooks/useEditorConfig';

export interface NoteEditorContentProps {
  editor: RichTextEditor | null;
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

function StaleConfigBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="sticky top-0 z-10 mx-auto max-w-[900px] mt-4 px-4 py-2 rounded-md border border-amber-300/40 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/40 text-xs text-amber-900 dark:text-amber-100 flex items-center justify-between gap-3">
      <span>
        Editor settings changed. Close and reopen this note to apply the new configuration.
      </span>
      <button
        onClick={onDismiss}
        className="text-amber-900/70 hover:text-amber-900 dark:text-amber-100/70 dark:hover:text-amber-100 underline-offset-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}

export const NoteEditorContent = forwardRef<HTMLDivElement, NoteEditorContentProps>(
  function NoteEditorContent({ editor, isLoading }, ref) {
    const { showBlockIndicators } = useEditorUI();
    const { staleForOpenEditor, acknowledgeOpenEditor } = useEditorConfig();

    return (
      <div ref={ref} className="flex-1 min-h-0 overflow-y-auto bg-background relative">
        {staleForOpenEditor && <StaleConfigBanner onDismiss={acknowledgeOpenEditor} />}
        {isLoading ? (
          <EditorSkeleton />
        ) : (
          <div
            className={`max-w-[900px] mx-auto px-16 py-12 ${!showBlockIndicators ? 'hide-block-indicators' : ''}`}
          >
            <RichTextEditorContent
              editor={editor}
              className="prose prose-stone dark:prose-invert max-w-none focus-within:outline-hidden min-h-[300px]"
            />
          </div>
        )}
      </div>
    );
  },
);
