import { X } from 'phosphor-react';
import { IconButton } from '@renderer/components/composites';
import { Skeleton } from '@renderer/components/base/ui/skeleton';
import type { TopicWithCount } from '@shared/types';
import { NoteRow, type TopicNote } from './NoteRow';

export function TopicNotesPanel({
  topic,
  notes,
  loading,
  onNoteClick,
  onClose,
}: {
  topic: TopicWithCount;
  notes: TopicNote[];
  loading: boolean;
  onNoteClick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="w-1/2 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-2">
        <div
          className="size-2 rounded-full"
          style={{ backgroundColor: topic.color || '#6366f1' }}
        />
        <span className="text-sm font-medium flex-1">{topic.name}</span>
        <span className="text-xs text-muted-foreground">{notes.length}</span>
        <IconButton size="normal" icon={<X size={14} />} tooltip="Close" onClick={onClose} />
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No notes
          </div>
        ) : (
          notes.map((note) => (
            <NoteRow key={note.id} note={note} onClick={() => onNoteClick(note.id)} />
          ))
        )}
      </div>
    </div>
  );
}
