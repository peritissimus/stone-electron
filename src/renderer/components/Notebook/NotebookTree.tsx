/**
 * Notebook Tree Component - Placeholder
 */

import React from 'react';
import { useNotebookStore } from '@renderer/stores/notebookStore';
import { CaretRight, CaretDown, FolderOpen, Folder } from 'phosphor-react';
import { Notebook } from '@shared/types';
import { Button } from '@renderer/components/ui/button';
import { Text } from '@renderer/components/ui/text';
import { ContainerFlex } from '@renderer/components/ui';

export function NotebookTree() {
  const { notebooks, activeNotebookId, expandedIds, setActiveNotebook, toggleExpanded } =
    useNotebookStore();

  if (notebooks.length === 0) {
    return <div className="p-3 text-xs text-muted-foreground text-center">No notebooks yet</div>;
  }

  return (
    <div className="px-2 py-1">
      {notebooks.map((notebook) => (
        <NotebookTreeItem
          key={notebook.id}
          notebook={notebook}
          isActive={notebook.id === activeNotebookId}
          isExpanded={expandedIds.has(notebook.id)}
          onSelect={() => setActiveNotebook(notebook.id)}
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
    <div>
      <ContainerFlex align="center" gap="xs" className="px-2" style={{ paddingLeft: `${level * 12 + 8}px` }}>
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
          </Button>
        ) : (
          <div className="w-5" />
        )}
        <Button
          onClick={onSelect}
          variant="ghost"
          className={`flex-1 justify-start gap-2 px-2 py-1.5 h-auto rounded-md text-xs transition-colors ${
            isActive ? 'bg-accent text-accent-foreground hover:bg-accent/90' : ''
          }`}
        >
          <Text size="sm" as="span">
            {notebook.icon || '📁'}
          </Text>
          <Text as="span" size="xs" className="flex-1 truncate">
            {notebook.name}
          </Text>
          {notebook.note_count !== undefined && (
            <Text as="span" size="xs" variant="muted">
              {notebook.note_count}
            </Text>
          )}
        </Button>
      </ContainerFlex>

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
    </div>
  );
}
