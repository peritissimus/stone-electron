import React, { useEffect, useRef, useState } from 'react';
import {
  FolderSimple,
  FolderOpen,
  DotsThreeVertical,
  PencilSimple,
  Trash,
  Plus,
} from '@phosphor-icons/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { IconButton } from '@renderer/components/composites';
import { Text } from '@renderer/components/base/ui/text';
import { useFileTree, type FileTreeNode } from '@renderer/hooks/useFileTree';
import { useSidebarCursor } from '@renderer/hooks/useSidebarCursor';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/lib/logger';
import { normalizePath } from '@renderer/lib/path';
import { FileLeaf } from './FileLeaf';

interface FolderNodeProps {
  node: FileTreeNode;
  level: number;
  onCreateNote: (folderPath: string | null) => Promise<void>;
  onRenameFile: (noteId: string, currentTitle: string) => void;
  onDeleteFile: (noteId: string) => Promise<void>;
  onMoveFile: (noteId: string, destinationPath: string | null) => Promise<void>;
  onRenameFolder: (folderPath: string, currentName: string) => void;
  onDeleteFolder: (folderPath: string) => Promise<void>;
  onMoveFolder: (sourcePath: string, destinationPath: string | null) => Promise<void>;
}

const handleDragEnd = (e: React.DragEvent) => {
  (e.target as HTMLElement).style.opacity = '';
};

export const FolderNode = React.memo<FolderNodeProps>(
  ({
    node,
    level,
    onCreateNote,
    onRenameFile,
    onDeleteFile,
    onMoveFile,
    onRenameFolder,
    onDeleteFolder,
    onMoveFolder,
  }) => {
    const normalizedPath = normalizePath(node.path);

    const { expandedPaths, activeFolder, toggleExpanded } = useFileTree();
    const isExpanded = expandedPaths.has(normalizedPath);
    const isActive = normalizePath(activeFolder || '') === normalizedPath;

    const { cursorPath, setCursor } = useSidebarCursor();
    const isCursor = cursorPath === normalizedPath;
    const rowRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (isCursor) {
        rowRef.current?.scrollIntoView({ block: 'nearest' });
      }
    }, [isCursor]);

    const [isDragOver, setIsDragOver] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const childFolders = node.children ?? [];
    const hasChildren = childFolders.length > 0;
    const isRootFolder = normalizedPath.length === 0;

    const handleDragStart = (e: React.DragEvent) => {
      if (isRootFolder) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(
        'application/stone-folder',
        JSON.stringify({
          folderPath: normalizedPath,
          type: 'folder',
        }),
      );
      (e.target as HTMLElement).style.opacity = '0.4';
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      logger.info('[FileTree] Drop event on folder', {
        targetPath: normalizedPath,
        folderName: node.name,
      });

      const noteData = e.dataTransfer.getData('application/stone-note');
      if (noteData) {
        try {
          const { noteId } = JSON.parse(noteData);
          await onMoveFile(noteId, normalizedPath || null);
        } catch (error) {
          logger.error('[FileTree] Failed to move note', {
            error,
            noteData,
            targetPath: normalizedPath,
          });
        }
        return;
      }

      const folderData = e.dataTransfer.getData('application/stone-folder');
      if (folderData) {
        try {
          const { folderPath } = JSON.parse(folderData);
          if (folderPath === normalizedPath || normalizedPath.startsWith(folderPath + '/')) {
            return;
          }
          await onMoveFolder(folderPath, normalizedPath || null);
        } catch (error) {
          logger.error('Failed to move folder:', error);
        }
      }
    };

    const handleClick = (event: React.MouseEvent | React.KeyboardEvent) => {
      event.stopPropagation();
      setCursor(normalizedPath);
      toggleExpanded(normalizedPath);
    };

    return (
      <>
        <div
          draggable={!isRootFolder}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'relative group transition-colors duration-150',
            isDragOver && 'ring-2 ring-primary/20 ring-offset-1 rounded',
          )}
        >
          <div
            ref={rowRef}
            className={cn(
              'relative flex items-center h-7 px-2 rounded cursor-pointer transition-colors duration-150',
              'hover:bg-accent/20',
              isCursor && 'ring-2 ring-primary/50',
            )}
            role="button"
            tabIndex={-1}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(e);
              }
            }}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
          >
            {isExpanded ? (
              <FolderOpen
                size={14}
                className={cn(
                  'mr-2 flex-shrink-0 transition-colors duration-150',
                  'text-muted-foreground',
                  isHovered && 'text-foreground/70',
                )}
              />
            ) : (
              <FolderSimple
                size={14}
                className={cn(
                  'mr-2 flex-shrink-0 transition-colors duration-150',
                  'text-muted-foreground',
                  isHovered && 'text-foreground/70',
                )}
              />
            )}
            <span
              className={cn(
                'flex-1 text-xs truncate transition-colors duration-150',
                isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {node.name}
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
                    label="Folder options"
                    className="size-5 hover:bg-accent"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={async () => {
                      await onCreateNote(normalizedPath);
                    }}
                  >
                    <Plus size={14} className="mr-2 text-muted-foreground" />
                    <Text size="xs">New Note Here</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isRootFolder}
                    onSelect={() => {
                      if (!isRootFolder) {
                        onRenameFolder(normalizedPath, node.name);
                      }
                    }}
                  >
                    <PencilSimple size={14} className="mr-2 text-muted-foreground" />
                    <Text size="xs">Rename Folder</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isRootFolder}
                    onSelect={async () => {
                      if (!isRootFolder) {
                        await onDeleteFolder(normalizedPath);
                      }
                    }}
                  >
                    <Trash size={14} className="mr-2 text-muted-foreground" />
                    <Text size="xs">Delete Folder</Text>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {(node.children ?? []).map((child) =>
              child.type === 'folder' ? (
                <FolderNode
                  key={`folder-${child.path}`}
                  node={child}
                  level={level + 1}
                  onCreateNote={onCreateNote}
                  onRenameFile={onRenameFile}
                  onDeleteFile={onDeleteFile}
                  onMoveFile={onMoveFile}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                  onMoveFolder={onMoveFolder}
                />
              ) : (
                <FileLeaf
                  key={`file-${child.path}`}
                  node={child}
                  level={level + 1}
                  onRename={onRenameFile}
                  onDelete={onDeleteFile}
                  onMove={onMoveFile}
                />
              ),
            )}
          </div>
        )}
      </>
    );
  },
);

FolderNode.displayName = 'FolderNode';
