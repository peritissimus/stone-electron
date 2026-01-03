/**
 * Note List File Item - File/note node in the note list tree
 *
 * Implements: specs/components.ts#NoteListItemProps
 */

import { formatDistanceToNow } from 'date-fns';
import { TreeItem } from '@renderer/components/composites';
import { Star, PushPin } from 'phosphor-react';

import type { Note } from '@shared/types';

export interface NoteListFileItemProps {
  note: Note | undefined;
  fileName: string;
  level: number;
  isActive: boolean;
  onClick: () => void;
}

export function NoteListFileItem({
  note,
  fileName,
  level,
  isActive,
  onClick,
}: NoteListFileItemProps) {
  const title = note?.title?.trim() ? note.title : fileName.replace(/\.md$/i, '');
  const updatedAt = note
    ? formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })
    : '';
  const isPinned = note?.isPinned;
  const isFavorite = note?.isFavorite;

  return (
    <TreeItem
      level={level}
      isActive={isActive}
      icon="📄"
      label={title || fileName}
      onClick={onClick}
      right={
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {isPinned && <PushPin size={10} className="text-primary" />}
          {isFavorite && <Star size={10} className="text-warning" />}
          {updatedAt}
        </div>
      }
    />
  );
}
