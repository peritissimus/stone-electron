import React, { useMemo } from 'react';
import { CaretDown, CaretRight, FileText, FolderSimple, Files } from 'phosphor-react';
import { Button } from '@renderer/components/ui/button';
import { TreeItem } from '@renderer/components/composites';
import { Text } from '@renderer/components/ui/text';
import { useFileTreeStore, FileTreeNode as StoreFileTreeNode } from '@renderer/stores/fileTreeStore';
import { useNoteStore } from '@renderer/stores/noteStore';

const normalizePath = (path: string) =>
  path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

const getParentPath = (path: string) => {
  const normalized = normalizePath(path);
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

  const normalizedPath = normalizePath(node.path);
  const isActive = selectedFile === normalizedPath;
  const parentPath = getParentPath(normalizedPath);
  const folderForSelection = parentPath || null;

  return (
    <TreeItem
      level={level}
      isActive={isActive}
      onClick={() => {
        setActiveFolder(folderForSelection);
        setSelectedFile(normalizedPath);
        const note = getNoteByFilePath(normalizedPath);
        if (note) {
          setActiveNote(note.id);
        }
      }}
      icon={<FileText size={14} className="text-muted-foreground" />}
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
    counts,
  } = useFileTreeStore();

  const normalizedPath = normalizePath(node.path);
  const childFolders = node.children ?? [];

  const hasChildren = childFolders.length > 0;
  const isExpanded = expandedPaths.has(normalizedPath);
  const isActive = normalizePath(activeFolder || '') === normalizedPath;

  const noteCount = counts[normalizedPath || '__root__'] || 0;

  return (
    <>
      <TreeItem
        level={level}
        isActive={isActive}
        onClick={() => {
          setActiveFolder(normalizedPath || null);
          setSelectedFile(null);
        }}
        icon={<FolderSimple size={14} className="text-muted-foreground" />}
        label={node.name}
        right={
          <Text size="xs" variant="muted" className="text-[10px]">
            {noteCount}
          </Text>
        }
        expander={
          hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(normalizedPath);
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
  const { tree, activeFolder, setActiveFolder, setSelectedFile, counts } = useFileTreeStore();
  const { notes } = useNoteStore();
  const allNotesCount = useMemo(() => notes.filter((n) => !n.isDeleted).length, [notes]);

  return (
    <div>
      <TreeItem
        level={0}
        isActive={!activeFolder}
        onClick={() => {
          setActiveFolder(null);
          setSelectedFile(null);
        }}
        icon={<Files size={14} className="text-muted-foreground" />}
        label="All Notes"
        right={<Text size="xs" variant="muted" className="text-[10px]">{allNotesCount}</Text>}
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
