/**
 * Note List Component - Display list of notes
 */

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNoteStore } from '@renderer/stores/noteStore';
import { useUIStore } from '@renderer/stores/uiStore';
import { useFileTreeStore } from '@renderer/stores/fileTreeStore';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
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
import {
  Header,
  ControlGroup,
  ListItem,
  ListContainer,
  CompactCard,
} from '@renderer/components/composites';

export function NoteList() {
  const { notes, activeNoteId, setActiveNote, getNoteByFilePath } = useNoteStore();
  const { viewMode, sortBy, sortOrder, showArchived, setViewMode, setSortBy, toggleSortOrder } =
    useUIStore();
  const { activeFolder, selectedFile, setSelectedFile } = useFileTreeStore();
  const { loadFileTree } = useFileTreeAPI();
  const { createNote, loadNotes, loadNoteById } = useNoteAPI();
  const [isCreating, setIsCreating] = useState(false);

  const folderLabel = activeFolder
    ? activeFolder.split('/').filter(Boolean).slice(-1)[0] || activeFolder
    : 'All Notes';

  const folderPath = activeFolder ? activeFolder : '';

  // Load notes for active folder (server-side), fallback to all
  useEffect(() => {
    if (activeFolder) {
      logger.info('[NoteList] loadNotes by folder', { folderPath: activeFolder });
      loadNotes({ folderPath: activeFolder });
    } else {
      logger.info('[NoteList] loadNotes all');
      loadNotes();
    }
  }, [activeFolder, loadNotes]);

  useEffect(() => {
    if (!selectedFile) return;
    const note = getNoteByFilePath(selectedFile);
    if (note) {
      setActiveNote(note.id);
      if (!note.content) {
        loadNoteById(note.id);
      }
    }
  }, [selectedFile, notes, getNoteByFilePath, setActiveNote, loadNoteById]);

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
        folderPath: activeFolder || undefined,
      });

      if (note) {
        setActiveNote(note.id);
        if (note.filePath) {
          setSelectedFile(note.filePath);
        }
        await loadFileTree();
      }
    } catch (error) {
      logger.error('Failed to create note:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-secondary">
      {/* Top Header - Title and View Controls */}
      <Header
        left={
          <div className="flex flex-col">
            <Heading3 className="text-sm">{folderLabel}</Heading3>
            {folderPath && (
              <Text size="xs" variant="muted" className="text-[10px]">
                {folderPath}
              </Text>
            )}
          </div>
        }
        right={
          <ControlGroup gap="xs" background="bg-muted">
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              size="sm"
              className="h-6 w-6 p-0"
              title="List view"
            >
              <List size={12} />
            </Toggle>
            <Toggle
              pressed={viewMode === 'grid'}
              onPressedChange={() => setViewMode('grid')}
              size="sm"
              className="h-6 w-6 p-0"
              title="Grid view"
            >
              <GridFour size={12} />
            </Toggle>
            <Toggle
              pressed={viewMode === 'card'}
              onPressedChange={() => setViewMode('card')}
              size="sm"
              className="h-6 w-6 p-0"
              title="Card view"
            >
              <Article size={12} />
            </Toggle>
          </ControlGroup>
        }
      />

      {/* Action Row - New Note Button */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0 bg-card">
        <Button
          onClick={handleCreateNote}
          disabled={isCreating}
          size="sm"
          className="w-full h-7 text-xs"
          title="Create a new note"
        >
          <Plus size={12} />
          {isCreating ? 'Creating...' : 'New Note'}
        </Button>
      </div>

      {/* Sort and Filter Row */}
      <div className="px-3 py-2.5 border-b border-border flex-shrink-0 bg-card">
        <ContainerFlex gap="xs" align="center" className="mb-2">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="flex-1 h-7 text-xs">
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
            className="h-7 w-7 p-0 flex-shrink-0"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <div className="flex flex-col">
              <CaretUp size={7} />
              <CaretDown size={7} />
            </div>
          </Button>
        </ContainerFlex>

        <Text size="xs" variant="muted" as="div">
          {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
        </Text>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto bg-card">
        {sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground text-xs">
            <Text size="xs" variant="muted">
              No notes found
            </Text>
            <Button onClick={handleCreateNote} disabled={isCreating} variant="outline" size="sm">
              <Plus size={14} />
              {isCreating ? 'Creating...' : 'Create your first note'}
            </Button>
          </div>
        ) : (
          <ListContainer viewMode={viewMode}>
            {sortedNotes.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={note.id === activeNoteId}
                onClick={async () => {
                  setActiveNote(note.id);
                  if (
                    note.filePath &&
                    (note.content === null || note.content === undefined)
                  ) {
                    await loadNoteById(note.id);
                  }
                }}
                viewMode={viewMode}
              />
            ))}
          </ListContainer>
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

  const rightContent = (
    <div className="flex items-center gap-0.5">
      {note.isPinned && <PushPin size={10} className="text-primary" />}
      {note.isFavorite && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
      {viewMode === 'list' && note.isArchived && (
        <Archive size={10} className="text-muted-foreground" />
      )}
    </div>
  );

  if (viewMode === 'list') {
    return (
      <ListItem
        isActive={isActive}
        onClick={onClick}
        title={note.title || 'Untitled'}
        right={rightContent}
      >
        <Text size="xs" variant="muted" as="div" className="line-clamp-1 text-[10px]">
          {preview}
        </Text>
        <Text size="xs" variant="muted" as="div" className="opacity-70 text-[10px]">
          {timeAgo}
        </Text>
      </ListItem>
    );
  }

  return (
    <CompactCard isActive={isActive} onClick={onClick} title={note.title || 'Untitled'}>
      <div className="text-[10px]">
        <div className="line-clamp-2 mb-1">{preview}</div>
        <div className="opacity-70">{timeAgo}</div>
      </div>
    </CompactCard>
  );
}
