/**
 * Notebook Tree Component - Optimized with memoization
 *
 * Implements: specs/components.ts#NotebookTreeProps
 */

import React, { useCallback } from 'react';
import { logger } from '@renderer/lib/logger';
import { useNotebooks } from '@renderer/hooks/useNotebooks';
import { CaretRight, CaretDown } from 'phosphor-react';
import { Notebook } from '@shared/types';
import { Button } from '@renderer/components/base/ui/button';
import { Text } from '@renderer/components/base/ui/text';
import { TreeItem } from '@renderer/components/composites';

export function NotebookTree() {
  const { notebooks } = useNotebooks();

  if (notebooks.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground text-center">No notebooks yet</div>;
  }

  return (
    <div>
      {notebooks.map((notebook) => (
        <NotebookTreeItem key={notebook.id} notebook={notebook} level={0} />
      ))}
    </div>
  );
}

interface NotebookWithChildren extends Notebook {
  children?: NotebookWithChildren[];
  note_count?: number;
}

interface NotebookTreeItemProps {
  notebook: NotebookWithChildren;
  level: number;
}

// Memoized tree item - only re-renders when notebook or level changes
const NotebookTreeItem = React.memo<NotebookTreeItemProps>(({ notebook, level }) => {
  // Get state and actions directly from store (avoids prop drilling)
  const { activeNotebookId, expandedIds, setActiveNotebook, toggleExpanded } = useNotebooks();

  const isActive = notebook.id === activeNotebookId;
  const isExpanded = expandedIds.has(notebook.id);
  const hasChildren = notebook.children && notebook.children.length > 0;

  const handleSelect = useCallback(() => {
    logger.info('[NotebookTree] select', { id: notebook.id, name: notebook.name });
    setActiveNotebook(notebook.id);
  }, [notebook.id, notebook.name, setActiveNotebook]);

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleExpanded(notebook.id);
    },
    [notebook.id, toggleExpanded],
  );

  return (
    <>
      <TreeItem
        level={level}
        isActive={isActive}
        onClick={handleSelect}
        icon={notebook.icon || '📁'}
        label={notebook.name}
        right={
          <>
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={handleToggleExpand}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
              </Button>
            )}
            {notebook.note_count !== undefined && (
              <Text as="span" size="xs" variant="muted" className="text-[10px]">
                {notebook.note_count}
              </Text>
            )}
          </>
        }
      >
        {hasChildren && isExpanded && (
          <div>
            {notebook.children?.map((child) => (
              <NotebookTreeItem key={child.id} notebook={child} level={level + 1} />
            ))}
          </div>
        )}
      </TreeItem>
    </>
  );
});

NotebookTreeItem.displayName = 'NotebookTreeItem';
