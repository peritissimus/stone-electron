/**
 * Note List Component - Display list of notes
 */

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useUIStore } from '@renderer/stores/uiStore';
import { useNotebookStore } from '@renderer/stores/notebookStore';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { Button } from '@renderer/components/ui/button';
import { Heading3, Text } from '@renderer/components/ui/text';
import { ContainerFlex } from '@renderer/components/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Toggle } from '@renderer/components/ui/toggle';
import { logger } from '@renderer/utils/logger';
import { Note } from '@shared/types';
import {
  Star,
  PushPin,
  Archive,
  List,
  GridFour,
  Article,
  CaretUp,
  CaretDown,
  Plus,
} from 'phosphor-react';

export function NoteList() {
  const { notes, activeNoteId, setActiveNote } = useNoteStore();
  const { viewMode, sortBy, sortOrder, showArchived, setViewMode, setSortBy, toggleSortOrder } =
    useUIStore();
  const { activeNotebookId } = useNotebookStore();
  const { createNote } = useNoteAPI();
  const [isCreating, setIsCreating] = useState(false);

  const filteredNotes = showArchived ? notes : notes.filter((n) => !n.isArchived);

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'updated':
        comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        break;
      case 'created':
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'favorite':
        comparison = Number(b.isFavorite) - Number(a.isFavorite);
        break;
    }

    return sortOrder === 'asc' ? -comparison : comparison;
  });

  const handleCreateNote = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const note = await createNote({
        title: '',
        content: '',
        notebookId: activeNotebookId || undefined,
      });

      if (note) {
        setActiveNote(note.id);
      }
    } catch (error) {
      logger.error('Failed to create note:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-secondary">
      {/* Header */}
      <div className="px-4 pt-titlebar pb-3 border-b border-border bg-card">
        <ContainerFlex justify="between" align="center" className="mb-3 gap-2">
          <Heading3>Notes</Heading3>
          <ContainerFlex gap="sm" align="center">
            <Button
              onClick={handleCreateNote}
              disabled={isCreating}
              size="sm"
              title="Create a new note"
            >
              <Plus size={14} />
              {isCreating ? 'Creating...' : 'New Note'}
            </Button>
            <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
              <Toggle
                pressed={viewMode === 'list'}
                onPressedChange={() => setViewMode('list')}
                size="sm"
                title="List view"
              >
                <List size={14} />
              </Toggle>
              <Toggle
                pressed={viewMode === 'grid'}
                onPressedChange={() => setViewMode('grid')}
                size="sm"
                title="Grid view"
              >
                <GridFour size={14} />
              </Toggle>
              <Toggle
                pressed={viewMode === 'card'}
                onPressedChange={() => setViewMode('card')}
                size="sm"
                title="Card view"
              >
                <Article size={14} />
              </Toggle>
            </div>
          </ContainerFlex>
        </ContainerFlex>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last Updated</SelectItem>
              <SelectItem value="created">Created Date</SelectItem>
              <SelectItem value="title">Title</SelectItem>
              <SelectItem value="favorite">Favorites</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSortOrder}
            className="h-8 w-8 p-0"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <div className="flex flex-col">
              <CaretUp size={8} />
              <CaretDown size={8} />
            </div>
          </Button>
        </div>

        <Text size="xs" variant="muted" as="div" className="mt-2">
          {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
        </Text>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto bg-card">
        {sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-xs">
            <Text size="xs" variant="muted">No notes found</Text>
            <Button onClick={handleCreateNote} disabled={isCreating} variant="outline" size="sm">
              <Plus size={14} />
              {isCreating ? 'Creating...' : 'Create your first note'}
            </Button>
          </div>
        ) : (
          <div
            className={
              viewMode === 'list' ? 'divide-y divide-border' : 'p-2 grid grid-cols-2 gap-2'
            }
          >
            {sortedNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={note.id === activeNoteId}
                onClick={() => setActiveNote(note.id)}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NoteItemProps {
  note: Note;
  isActive: boolean;
  onClick: () => void;
  viewMode: 'list' | 'grid' | 'card';
}

function NoteItem({ note, isActive, onClick, viewMode }: NoteItemProps) {
  const preview = (note.content || '').replace(/[#*`>\-\[\]]/g, '').substring(0, 100);
  const timeAgo = formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true });

  if (viewMode === 'list') {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 transition-colors ${
          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <Text weight="medium" size="sm" as="div" className="line-clamp-1">
            {note.title || 'Untitled'}
          </Text>
          <div className="flex items-center gap-1 flex-shrink-0">
            {note.isPinned && <PushPin size={12} className="text-primary" />}
            {note.isFavorite && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
            {note.isArchived && <Archive size={12} className="text-muted-foreground" />}
          </div>
        </div>
        <Text size="xs" variant="muted" as="div" className="line-clamp-2 mb-1">{preview}</Text>
        <Text size="xs" variant="muted" as="div" className="opacity-70">{timeAgo}</Text>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`text-left p-2.5 rounded-lg transition-all ${
        isActive
          ? 'bg-accent ring-1 ring-primary shadow-sm'
          : 'bg-background hover:bg-muted/50 border border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <Text weight="medium" size="xs" as="div" className="line-clamp-2">
          {note.title || 'Untitled'}
        </Text>
        <div className="flex items-center gap-1 flex-shrink-0">
          {note.isPinned && <PushPin size={10} className="text-primary" />}
          {note.isFavorite && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
        </div>
      </div>
      <Text size="xs" variant="muted" as="div" className="line-clamp-2 mb-1.5">{preview}</Text>
      <Text size="xs" variant="muted" as="div" className="opacity-70">{timeAgo}</Text>
    </button>
  );
}
