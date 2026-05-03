/**
 * JournalDayEditor — inline rich-text editor for a single journal day.
 *
 * Mounted once per day in the journals timeline. Content is preloaded into
 * the documentBufferStore by useJournalTimeline when the timeline loads, so
 * the editor hydrates from buffer (no per-row IPC). Edits go through the
 * standard documentBuffer + useDocumentAutosave path — saved on window blur.
 */

import { RichTextEditorContent, useRichTextEditor } from '@renderer/editor';
import { useDocumentBuffer } from '@renderer/hooks/useDocumentBuffer';

interface JournalDayEditorProps {
  noteId: string;
}

export function JournalDayEditor({ noteId }: JournalDayEditorProps) {
  const editor = useRichTextEditor();
  useDocumentBuffer({ noteId, editor });

  return (
    <div className="journal-day-editor">
      <RichTextEditorContent editor={editor} />
    </div>
  );
}
