/**
 * Note List Folder Item - Folder node in the note list tree
 *
 * Implements: specs/components.ts#FolderItemProps
 */

import React, { memo } from 'react';
import { Button } from '@renderer/components/base/ui/button';
import { Text } from '@renderer/components/base/ui/text';
import { TreeItem } from '@renderer/components/composites';
import { CaretRight } from 'phosphor-react';

import type { FileTreeNode } from '@renderer/hooks/useFileTree';

export interface NoteListFolderItemProps {
  node: FileTreeNode;
  level: number;
  isActive: boolean;
  isExpanded: boolean;
  noteCount: number;
  onClick: () => void;
  onToggle: () => void;
  children?: React.ReactNode;
}

export const NoteListFolderItem = memo(function NoteListFolderItem({
  node,
  level,
  isActive,
  isExpanded,
  noteCount,
  onClick,
  onToggle,
  children,
}: NoteListFolderItemProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div>
      <TreeItem
        level={level}
        isActive={isActive}
        icon="📁"
        label={node.name}
        onClick={onClick}
        right={
          <>
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle();
                }}
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              >
                <CaretRight
                  size={10}
                  className={`motion-safe:transition-transform duration-200 ease-out ${isExpanded ? 'rotate-90' : ''}`}
                />
              </Button>
            )}
            <Text size="xs" variant="muted" className="text-[10px]">
              {noteCount}
            </Text>
          </>
        }
      />
      {children && (
        <div
          className={`grid motion-safe:transition-[grid-template-rows] duration-200 ease-out ${
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">{children}</div>
        </div>
      )}
    </div>
  );
});
