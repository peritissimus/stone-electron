import React from 'react';
import { CaretDown, CaretRight } from 'phosphor-react';
import { Button } from '@renderer/components/ui/button';
import { TreeItem } from '@renderer/components/composites';
import { useFileTreeStore, FileTreeNode as StoreFileTreeNode } from '@renderer/stores/fileTreeStore';
import { useNoteStore } from '@renderer/stores/noteStore';

const getParentPath = (path: string) => {
  const normalized = path.replace(/\\/g, '/');
  if (!normalized.includes('/')) return '';
  return normalized.slice(0, normalized.lastIndexOf('/'));
};

const getDisplayName = (name: string) => {
  return name.endsWith('.md') ? name.replace(/\.md$/i, '') : name;
};

interface FileTreeFileProps {
  node: StoreFileTreeNode;
  level: number;
}

const FileLeaf: React.FC<FileTreeFileProps> = ({ node, level }) => {
  const { selectedFile, setSelectedFile, setActiveFolder } = useFileTreeStore();
  const { setActiveNote, getNoteByFilePath } = useNoteStore();

  const isActive = selectedFile === node.path;
  const parentPath = getParentPath(node.path);
  const folderForSelection = parentPath || null;

  return (
    <TreeItem
      level={level}
      isActive={isActive}
      onClick={() => {
        setActiveFolder(folderForSelection);
        setSelectedFile(node.path);
        const note = getNoteByFilePath(node.path);
        if (note) {
          setActiveNote(note.id);
        }
      }}
      icon="📄"
      label={getDisplayName(node.name)}
    />
  );
};

interface FileTreeNodeProps {
  node: StoreFileTreeNode;
  level: number;
}

const FolderChildren: React.FC<FileTreeNodeProps> = ({ node, level }) => {
  const {
    activeFolder,
    expandedPaths,
    setActiveFolder,
    toggleExpanded,
    setSelectedFile,
  } = useFileTreeStore();

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
        onClick={() => {
          setActiveFolder(node.path || null);
          setSelectedFile(null);
        }}
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
          {(node.children ?? []).map((child) =>
            child.type === 'folder' ? (
              <FolderChildren key={`folder-${child.path}`} node={child} level={level + 1} />
            ) : (
              <FileLeaf key={`file-${child.path}`} node={child} level={level + 1} />
            ),
          )}
        </div>
      )}
    </>
  );
};

export function FileTree() {
  const { tree, activeFolder, setActiveFolder, setSelectedFile } = useFileTreeStore();

  return (
    <div>
      <TreeItem
        level={0}
        isActive={!activeFolder}
        onClick={() => {
          setActiveFolder(null);
          setSelectedFile(null);
        }}
        icon="🗂️"
        label="All Notes"
      />
      {tree.map((node) =>
        node.type === 'folder' ? (
          <FolderChildren key={`folder-${node.path || node.name}`} node={node} level={0} />
        ) : (
          <FileLeaf key={`file-${node.path}`} node={node} level={0} />
        ),
      )}
    </div>
  );
}
