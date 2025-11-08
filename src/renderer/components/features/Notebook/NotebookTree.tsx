/**
 * Notebook Tree Component - Placeholder
 */

import React from 'react';
import { logger } from '@renderer/utils/logger';
import { useNotebookStore } from '@renderer/stores/notebookStore';
import { CaretRight, CaretDown } from 'phosphor-react';
import { Notebook } from '@shared/types';
import { Button } from '@renderer/components/base/ui/button';
import { Text } from '@renderer/components/base/ui/text';
import { TreeItem } from '@renderer/components/composites';

export function NotebookTree() {
  const { notebooks, activeNotebookId, expandedIds, setActiveNotebook, toggleExpanded } =
    useNotebookStore();

  if (notebooks.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground text-center">No notebooks yet</div>;
  }

  return (
    <div>
      {notebooks.map((notebook) => (
        <NotebookTreeItem
          key={notebook.id}
          notebook={notebook}
          isActive={notebook.id === activeNotebookId}
          isExpanded={expandedIds.has(notebook.id)}
          onSelect={() => {
            logger.info('[NotebookTree] select', { id: notebook.id, name: notebook.name });
            setActiveNotebook(notebook.id);
          }}
          onToggleExpand={() => toggleExpanded(notebook.id)}
          activeNotebookId={activeNotebookId}
          expandedIds={expandedIds}
          setActiveNotebook={setActiveNotebook}
          toggleExpanded={toggleExpanded}
        />
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
  isActive: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  activeNotebookId: string | null;
  expandedIds: Set<string>;
  setActiveNotebook: (id: string | null) => void;
  toggleExpanded: (id: string) => void;
  level?: number;
}

function NotebookTreeItem({
  notebook,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpand,
  activeNotebookId,
  expandedIds,
  setActiveNotebook,
  toggleExpanded,
  level = 0,
}: NotebookTreeItemProps) {
  const hasChildren = notebook.children && notebook.children.length > 0;

  return (
    <>
      <TreeItem
        level={level}
        isActive={isActive}
        onClick={onSelect}
        icon={notebook.icon || '📁'}
        label={notebook.name}
        right={
          <>
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
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
              <NotebookTreeItem
                key={child.id}
                notebook={child}
                isActive={child.id === activeNotebookId}
                isExpanded={expandedIds.has(child.id)}
                onSelect={() => setActiveNotebook(child.id)}
                onToggleExpand={() => toggleExpanded(child.id)}
                activeNotebookId={activeNotebookId}
                expandedIds={expandedIds}
                setActiveNotebook={setActiveNotebook}
                toggleExpanded={toggleExpanded}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </TreeItem>
    </>
  );
}
