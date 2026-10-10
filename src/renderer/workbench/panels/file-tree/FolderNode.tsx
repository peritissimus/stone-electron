import React, { useState } from 'react';
import { FolderSimple, FolderOpen, Plus } from '@phosphor-icons/react';
import {
  useFileTreeFolder,
  type FileTreeNode,
} from '@renderer/services/workspace/hooks/useFileTree';
import { useSidebarItemCursor } from '@renderer/services/view-state/hooks/useSidebarCursor';
import { getSidebarTreeItemId } from '@renderer/lib/sidebarTree';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/services/telemetry/logger';
import { normalizePath } from '@renderer/lib/path';
import {
  fileTreeIconClassName,
  fileTreeLabelClassName,
  fileTreeRowClassName,
  getFileTreeRowStyle,
} from './fileTreeStyles';

interface FolderNodeProps {
  node: FileTreeNode;
  level: number;
  positionInSet: number;
  setSize: number;
  onCreateNote: (folderPath: string | null) => Promise<void>;
  onMoveFile: (noteId: string, destinationPath: string | null) => Promise<void>;
  onMoveFolder: (sourcePath: string, destinationPath: string | null) => Promise<void>;
}

const handleDragEnd = (e: React.DragEvent) => {
  (e.target as HTMLElement).style.opacity = '';
};

export const FolderNode = React.memo<FolderNodeProps>(
  ({ node, level, positionInSet, setSize, onCreateNote, onMoveFile, onMoveFolder }) => {
    const normalizedPath = normalizePath(node.path);

    const { isExpanded, isActive, toggleExpanded } = useFileTreeFolder(normalizedPath);

    const { isCursor, requestFocus } = useSidebarItemCursor(normalizedPath);
    const itemId = getSidebarTreeItemId(normalizedPath);
    const hasChildren = (node.children?.length ?? 0) > 0;

    const [isDragOver, setIsDragOver] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

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
      requestFocus(normalizedPath);
      toggleExpanded(normalizedPath);
    };

    return (
      <div
        id={itemId}
        role="treeitem"
        aria-labelledby={`${itemId}-label`}
        aria-level={level + 1}
        aria-posinset={positionInSet}
        aria-setsize={setSize}
        aria-expanded={hasChildren ? isExpanded : undefined}
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
          className={fileTreeRowClassName}
          data-sidebar-cursor={isCursor ? 'true' : undefined}
          title={normalizedPath || node.name}
          onClick={handleClick}
          style={getFileTreeRowStyle(level)}
        >
          {isExpanded ? (
            <FolderOpen
              size={16}
              className={cn(fileTreeIconClassName, isHovered && 'text-foreground/70')}
            />
          ) : (
            <FolderSimple
              size={16}
              className={cn(fileTreeIconClassName, isHovered && 'text-foreground/70')}
            />
          )}
          <span
            id={`${itemId}-label`}
            className={cn(
              fileTreeLabelClassName,
              isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
            )}
          >
            {node.name}
          </span>

          <div
            className={cn(
              'ms-auto shrink-0 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100',
              (isHovered || isCursor) && 'opacity-100',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => void onCreateNote(normalizedPath)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,scale] duration-150 ease-out hover:bg-foreground/10 hover:text-foreground active:scale-[0.96]"
              title={`New note in ${node.name}`}
              aria-label={`Create note in ${node.name}`}
              tabIndex={isCursor ? 0 : -1}
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    );
  },
);

FolderNode.displayName = 'FolderNode';
