import React, { useEffect, useRef, useState } from 'react';
import { FolderSimple, FolderOpen, Plus } from '@phosphor-icons/react';
import { useFileTree, type FileTreeNode } from '@renderer/hooks/useFileTree';
import { useSidebarCursor } from '@renderer/hooks/useSidebarCursor';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/lib/logger';
import { normalizePath } from '@renderer/lib/path';
import { FileLeaf } from './FileLeaf';
import {
  fileTreeIconClassName,
  fileTreeLabelClassName,
  fileTreeRowClassName,
  getFileTreeRowStyle,
} from './fileTreeStyles';

interface FolderNodeProps {
  node: FileTreeNode;
  level: number;
  onCreateNote: (folderPath: string | null) => Promise<void>;
  onRenameFile: (noteId: string, currentTitle: string) => void;
  onDeleteFile: (noteId: string) => Promise<void>;
  onMoveFile: (noteId: string, destinationPath: string | null) => Promise<void>;
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
            className={fileTreeRowClassName}
            data-sidebar-cursor={isCursor ? 'true' : undefined}
            role="button"
            tabIndex={-1}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(e);
              }
            }}
            style={getFileTreeRowStyle(level)}
          >
            {isExpanded ? (
              <FolderOpen
                size={16}
                className={cn(
                  fileTreeIconClassName,
                  isHovered && 'text-foreground/70',
                )}
              />
            ) : (
              <FolderSimple
                size={16}
                className={cn(
                  fileTreeIconClassName,
                  isHovered && 'text-foreground/70',
                )}
              />
            )}
            <span
              className={cn(
                fileTreeLabelClassName,
                isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {node.name}
            </span>

            <div
              className={cn(
                'ml-auto opacity-0 transition-opacity duration-150 group-focus-within:opacity-100',
                isHovered && 'opacity-100',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => void onCreateNote(normalizedPath)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-foreground/10 hover:text-foreground active:scale-[0.96]"
                title={`New note in ${node.name}`}
                aria-label={`Create note in ${node.name}`}
              >
                <Plus size={14} weight="bold" />
              </button>
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
