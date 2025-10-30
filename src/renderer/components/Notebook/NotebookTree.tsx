/**
 * Notebook Tree Component - Placeholder
 */

import React from 'react'
import { useNotebookStore } from '../../stores/notebookStore'
import { ChevronRight, ChevronDown, FolderOpen, Folder } from 'lucide-react'

export function NotebookTree() {
  const { notebooks, activeNotebookId, expandedIds, setActiveNotebook, toggleExpanded } = useNotebookStore()

  if (notebooks.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        No notebooks yet
      </div>
    )
  }

  return (
    <div className="p-2">
      {notebooks.map((notebook) => (
        <NotebookTreeItem
          key={notebook.id}
          notebook={notebook}
          isActive={notebook.id === activeNotebookId}
          isExpanded={expandedIds.has(notebook.id)}
          onSelect={() => setActiveNotebook(notebook.id)}
          onToggleExpand={() => toggleExpanded(notebook.id)}
        />
      ))}
    </div>
  )
}

interface NotebookTreeItemProps {
  notebook: any
  isActive: boolean
  isExpanded: boolean
  onSelect: () => void
  onToggleExpand: () => void
  level?: number
}

function NotebookTreeItem({
  notebook,
  isActive,
  isExpanded,
  onSelect,
  onToggleExpand,
  level = 0,
}: NotebookTreeItemProps) {
  const hasChildren = notebook.children && notebook.children.length > 0

  return (
    <div>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            className="flex-shrink-0"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
        {!hasChildren && <div className="w-4" />}
        <span className="text-base">{notebook.icon || '📁'}</span>
        <span className="flex-1 truncate">{notebook.name}</span>
        {notebook.note_count !== undefined && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{notebook.note_count}</span>
        )}
      </button>

      {hasChildren && isExpanded && (
        <div>
          {notebook.children.map((child: any) => (
            <NotebookTreeItem
              key={child.id}
              notebook={child}
              isActive={child.id === activeNotebookId}
              isExpanded={expandedIds.has(child.id)}
              onSelect={() => setActiveNotebook(child.id)}
              onToggleExpand={() => toggleExpanded(child.id)}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
