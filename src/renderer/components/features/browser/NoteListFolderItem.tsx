/**
 * Note List Folder Item - Folder node in the note list tree
 *
 * Implements: specs/components.ts#FolderItemProps
 */

import React from 'react';
import { Button } from '@renderer/components/base/ui/button';
import { Text } from '@renderer/components/base/ui/text';
import { TreeItem } from '@renderer/components/composites';
import { CaretDown, CaretRight } from 'phosphor-react';

import type { FileTreeNode } from '@renderer/stores/fileTreeStore';

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

export function NoteListFolderItem({
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
                {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
              </Button>
            )}
            <Text size="xs" variant="muted" className="text-[10px]">
              {noteCount}
            </Text>
          </>
        }
      />
      {isExpanded && children && <div>{children}</div>}
    </div>
  );
}
