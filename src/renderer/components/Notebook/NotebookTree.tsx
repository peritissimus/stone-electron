/**
 * Notebook Tree Component - Placeholder
 */

import React from 'react';
import { useNotebookStore } from '../../stores/notebookStore';
import { ChevronRight, ChevronDown, FolderOpen, Folder } from 'lucide-react';
import { Notebook } from '@shared/types';

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
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-foreground'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="flex-shrink-0"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
        {!hasChildren && <div className="w-3" />}
        <span className="text-sm">{notebook.icon || '📁'}</span>
        <span className="flex-1 truncate">{notebook.name}</span>
        {notebook.note_count !== undefined && (
          <span className="text-xs text-muted-foreground">{notebook.note_count}</span>
        )}
      </button>

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
