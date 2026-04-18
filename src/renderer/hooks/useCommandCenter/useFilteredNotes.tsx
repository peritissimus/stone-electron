import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'phosphor-react';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useUIStore } from '@renderer/stores/uiStore';
import { fuzzyFilter } from '@renderer/lib/fuzzyMatch';
import type { CommandItem } from './types';

export function useFilteredNotes(query: string): CommandItem[] {
  const navigate = useNavigate();
  const { notes } = useNoteStore();

  const handleSelectNote = useCallback(
    (noteId: string) => {
      navigate(`/note/${noteId}`);
      useUIStore.getState().closeCommandCenter();
    },
    [navigate],
  );

  return useMemo<CommandItem[]>(() => {
    const activeNotes = notes.filter((n) => !n.isDeleted);
    const q = query.trim();

    if (q.length === 0) {
      const getTime = (date: Date | string | number | undefined) => {
        if (!date) return 0;
        if (date instanceof Date) return date.getTime();
        if (typeof date === 'string') return new Date(date).getTime();
        return date;
      };
      return activeNotes
        .sort((a, b) => {
          const aTime = getTime(a.updatedAt);
          const bTime = getTime(b.updatedAt);
          return bTime - aTime;
        })
        .slice(0, 3)
        .map((note) => ({
          id: `note-${note.id}`,
          type: 'note' as const,
          title: note.title || 'Untitled',
          subtitle: note.filePath?.replace(/^.*[/\\]/, '') || undefined,
          icon: <FileText size={18} />,
          score: 100,
          action: () => handleSelectNote(note.id),
        }));
    }

    return fuzzyFilter(activeNotes, q, (note) => [note.title || 'Untitled', note.filePath || ''])
      .slice(0, 15)
      .map(({ score, ...note }) => ({
        id: `note-${note.id}`,
        type: 'note' as const,
        title: note.title || 'Untitled',
        subtitle: note.filePath?.replace(/^.*[/\\]/, '') || undefined,
        icon: <FileText size={18} />,
        score,
        action: () => handleSelectNote(note.id),
      }));
  }, [notes, query, handleSelectNote]);
}
