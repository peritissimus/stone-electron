import React, { useEffect, useRef, useState } from 'react';
import { FileText, DotsThreeVertical, PencilSimple, Trash } from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { IconButton } from '@renderer/components/composites';
import { Text } from '@renderer/components/base/ui/text';
import { type FileTreeNode } from '@renderer/services/workspace/hooks/useFileTree';
import { useNotes, getNotesByPathSnapshot } from '@renderer/features/notes/hooks/useNotes';
import { useNoteAPI } from '@renderer/features/notes/commands/useNoteAPI';
import { useNavigateToNote } from '@renderer/services/navigation';
import { useSidebarCursor } from '@renderer/services/view-state/hooks/useSidebarCursor';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/services/telemetry/logger';
import { normalizePath, getDisplayName } from '@renderer/lib/path';
import { prefetchWorkbenchView } from '@renderer/workbench/editor-group/viewRegistry';
import {
  fileTreeIconClassName,
  fileTreeLabelClassName,
  fileTreeRowClassName,
  getFileTreeRowStyle,
} from './fileTreeStyles';

interface FileLeafProps {
  node: FileTreeNode;
  level: number;
  onRename: (noteId: string, currentTitle: string) => void;
  onDelete: (noteId: string) => Promise<void>;
  onMove: (noteId: string, destinationPath: string | null) => Promise<void>;
}

const handleDragEnd = (e: React.DragEvent) => {
  (e.target as HTMLElement).style.opacity = '';
};

export const FileLeaf = React.memo<FileLeafProps>(({ node, level, onRename, onDelete }) => {
  const normalizedPath = normalizePath(node.path);

  const navigateToNote = useNavigateToNote();
  const { activeNoteId, notesByPath } = useNotes();
  const note = notesByPath.get(normalizedPath);

  const { loadNoteByPath } = useNoteAPI();

  const isActive = note?.id === activeNoteId;
  const [isHovered, setIsHovered] = useState(false);

  const { cursorPath, setCursor } = useSidebarCursor();
  const isCursor = cursorPath === normalizedPath;
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isCursor) {
      rowRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [isCursor]);

  const handleOpen = async () => {
    logger.info('[FileTree] Opening file', { normalizedPath, fileName: node.name });
    setCursor(normalizedPath);

    const currentNotesByPath = getNotesByPathSnapshot();
    const cachedNote = currentNotesByPath.get(normalizedPath);

    if (cachedNote) {
      navigateToNote(cachedNote.id);
      return;
    }

    const loadedNote = await loadNoteByPath(normalizedPath);
    if (loadedNote) {
      navigateToNote(loadedNote.id);
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

  return (
    <div
      draggable={!!note}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => {
        setIsHovered(true);
        prefetchWorkbenchView('/note');
      }}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group transition-colors duration-150"
    >
      <div
        ref={rowRef}
        className={cn(
          fileTreeRowClassName,
          isActive ? 'bg-secondary text-foreground' : 'hover:bg-muted/60',
        )}
        data-sidebar-cursor={isCursor ? 'true' : undefined}
        role="button"
        tabIndex={-1}
        onFocus={() => prefetchWorkbenchView('/note')}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
        style={getFileTreeRowStyle(level)}
      >
        <FileText
          size={16}
          className={cn(
            fileTreeIconClassName,
            isActive ? 'text-foreground' : 'text-muted-foreground',
            isHovered && !isActive && 'text-foreground/70',
          )}
        />
        <span
          className={cn(
            fileTreeLabelClassName,
            isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
          )}
        >
          {note?.title?.trim() ? note.title : getDisplayName(node.name)}
        </span>

        <div
          className={cn(
            'ml-auto opacity-0 transition-opacity duration-150 group-focus-within:opacity-100',
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
                className="size-6 hover:bg-foreground/10"
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
