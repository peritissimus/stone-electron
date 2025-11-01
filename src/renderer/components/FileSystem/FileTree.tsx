import React from 'react';
import { CaretDown, CaretRight } from 'phosphor-react';
import { Button } from '@renderer/components/ui/button';
import { TreeItem } from '@renderer/components/composites';
import { useFileTreeStore, FileTreeNode as StoreFileTreeNode } from '@renderer/stores/fileTreeStore';

interface FileTreeNodeProps {
  node: StoreFileTreeNode;
  level: number;
}

const FolderChildren: React.FC<FileTreeNodeProps> = ({ node, level }) => {
  const { activeFolder, expandedPaths, setActiveFolder, toggleExpanded } = useFileTreeStore();

  const childFolders =
    node.children?.filter((child) => child.type === 'folder') ?? [];

  const hasChildren = childFolders.length > 0;
  const isExpanded = expandedPaths.has(node.path);
  const isActive = activeFolder === node.path;

  return (
    <>
      <TreeItem
        level={level}
        isActive={isActive}
        onClick={() => setActiveFolder(node.path || null)}
        icon="📁"
        label={node.name}
        expander={
          hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(node.path);
              }}
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            >
              {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
            </Button>
          ) : undefined
        }
      />
      {hasChildren && isExpanded && (
        <div>
          {childFolders.map((child) => (
            <FolderChildren key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </>
  );
};

export function FileTree() {
  const { tree, activeFolder, setActiveFolder } = useFileTreeStore();

  return (
    <div>
      <TreeItem
        level={0}
        isActive={!activeFolder}
        onClick={() => setActiveFolder(null)}
        icon="🗂️"
        label="All Notes"
      />
      {tree.map((node) => (
        <FolderChildren key={node.path || node.name} node={node} level={0} />
      ))}
    </div>
  );
}
