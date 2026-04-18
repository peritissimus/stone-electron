import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, DotsThreeVertical, PencilSimple, Trash } from 'phosphor-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { IconButton } from '@renderer/components/composites';
import { Text } from '@renderer/components/base/ui/text';
import { useFileTree, type FileTreeNode } from '@renderer/hooks/useFileTree';
import { useNotes, getNotesByPathSnapshot } from '@renderer/hooks/useNotes';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/lib/logger';
import { normalizePath, getParentPath, getDisplayName } from '@renderer/lib/path';

interface FileLeafProps {
  node: FileTreeNode;
  level: number;
  onRename: (noteId: string, currentTitle: string) => void;
  onDelete: (noteId: string) => Promise<void>;
  onMove: (noteId: string, destinationPath: string | null) => Promise<void>;
}

export const FileLeaf = React.memo<FileLeafProps>(({ node, level, onRename, onDelete }) => {
  const navigate = useNavigate();
  const normalizedPath = normalizePath(node.path);

  const { setSelectedFile, setActiveFolder } = useFileTree();
  const { activeNoteId, notesByPath } = useNotes();
  const note = notesByPath.get(normalizedPath);

  const { loadNoteByPath } = useNoteAPI();

  const isActive = note?.id === activeNoteId;
  const [isHovered, setIsHovered] = useState(false);

  const parentPath = getParentPath(normalizedPath);
  const folderForSelection = parentPath || null;

  const handleOpen = async () => {
    logger.info('[FileTree] Opening file', {
      normalizedPath,
      folderForSelection,
      fileName: node.name,
    });

    setActiveFolder(folderForSelection);
    setSelectedFile(normalizedPath);

    const currentNotesByPath = getNotesByPathSnapshot();
    const cachedNote = currentNotesByPath.get(normalizedPath);

    if (cachedNote) {
      logger.info('[FileTree] Found note in cache', {
        noteId: cachedNote.id,
        noteTitle: cachedNote.title,
      });
      navigate(`/note/${cachedNote.id}`);
      return;
    }

    logger.info('[FileTree] Note not in cache, loading via hook', { normalizedPath });
    const loadedNote = await loadNoteByPath(normalizedPath);
    if (loadedNote) {
      logger.info('[FileTree] Loaded note via hook', {
        noteId: loadedNote.id,
        noteTitle: loadedNote.title,
      });
      navigate(`/note/${loadedNote.id}`);
    } else {
      logger.warn('[FileTree] No note found for file path', { normalizedPath });
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!note) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/stone-note',
      JSON.stringify({
        noteId: note.id,
        filePath: normalizedPath,
        type: 'file',
      }),
    );
    (e.target as HTMLElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '';
  };

  return (
    <div
      draggable={!!note}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group transition-colors duration-150"
    >
      <div
        className={cn(
          'relative flex items-center h-7 px-2 rounded cursor-pointer transition-colors duration-150',
          isActive ? 'bg-accent/40' : 'hover:bg-accent/20',
        )}
        onClick={handleOpen}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <FileText
          size={14}
          className={cn(
            'mr-2 flex-shrink-0 transition-colors duration-150',
            isActive ? 'text-foreground' : 'text-muted-foreground',
            isHovered && !isActive && 'text-foreground/70',
          )}
        />
        <span
          className={cn(
            'flex-1 text-xs truncate transition-colors duration-150',
            isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
          )}
        >
          {note?.title?.trim() ? note.title : getDisplayName(node.name)}
        </span>

        <div
          className={cn(
            'ml-auto opacity-0 transition-opacity duration-150',
            isHovered && 'opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="compact"
                icon={<DotsThreeVertical size={14} />}
                label="File options"
                className="h-5 w-5 hover:bg-accent"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                disabled={!note}
                onSelect={() => {
                  if (note) {
                    onRename(note.id, note.title || getDisplayName(node.name));
                  }
                }}
              >
                <PencilSimple size={14} className="mr-2 text-muted-foreground" />
                <Text size="xs">Rename</Text>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!note}
                onSelect={async () => {
                  if (note) {
                    await onDelete(note.id);
                  }
                }}
              >
                <Trash size={14} className="mr-2 text-muted-foreground" />
                <Text size="xs">Delete</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});

FileLeaf.displayName = 'FileLeaf';
