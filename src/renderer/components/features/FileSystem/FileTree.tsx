import React, { useState } from 'react';
import {
  FileText,
  FolderSimple,
  FolderOpen,
  DotsThreeVertical,
  PencilSimple,
  Trash,
  Plus,
  Files,
} from 'phosphor-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/base/ui/dropdown-menu';
import { IconButton, TreeItem } from '@renderer/components/composites';
import { Text } from '@renderer/components/base/ui/text';
import {
  useFileTreeStore,
  FileTreeNode as StoreFileTreeNode,
} from '@renderer/stores/fileTreeStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { InputModal } from '@renderer/components/base/common';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';

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
  onRename: (noteId: string, currentTitle: string) => void;
  onDelete: (noteId: string) => Promise<void>;
}

const FileLeaf: React.FC<FileTreeFileProps> = ({ node, level, onRename, onDelete }) => {
  const { selectedFile, setSelectedFile, setActiveFolder } = useFileTreeStore();
  const { setActiveNote, getNoteByFilePath } = useNoteStore();

  const normalizedPath = normalizePath(node.path);
  const isActive = selectedFile === normalizedPath;
  const parentPath = getParentPath(normalizedPath);
  const folderForSelection = parentPath || null;

  const handleOpen = () => {
    setActiveFolder(folderForSelection);
    setSelectedFile(normalizedPath);
    const note = getNoteByFilePath(normalizedPath);
    if (note) {
      setActiveNote(note.id);
    }
  };

  const note = getNoteByFilePath(normalizedPath);

  return (
    <TreeItem
      level={level}
      isActive={isActive}
      onClick={handleOpen}
      icon={<FileText size={14} className="text-muted-foreground" />}
      label={note?.title?.trim() ? note.title : getDisplayName(node.name)}
      rightSlotProps={{
        className: 'flex items-center gap-1',
        onClick: (event) => event.stopPropagation(),
        onPointerDown: (event) => event.stopPropagation(),
        onPointerUp: (event) => event.stopPropagation(),
      }}
      right={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton
              size="compact"
              icon={<DotsThreeVertical size={14} />}
              label="File options"
              tooltip="File options"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              disabled={!note}
              onSelect={() => {
                if (note) {
                  onRename(note.id, note.title || getDisplayName(node.name));
                }
              }}
            >
              <PencilSimple size={14} className="mr-2 text-muted-foreground" />
              <Text size="xs">Rename</Text>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!note}
              onSelect={async () => {
                if (note) {
                  await onDelete(note.id);
                }
              }}
            >
              <Trash size={14} className="mr-2 text-muted-foreground" />
              <Text size="xs">Delete</Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
};

interface FolderNodeProps {
  node: StoreFileTreeNode;
  level: number;
  onCreateNote: (folderPath: string | null) => Promise<void>;
  onRenameFile: (noteId: string, currentTitle: string) => void;
  onDeleteFile: (noteId: string) => Promise<void>;
  onRenameFolder: (folderPath: string, currentName: string) => void;
  onDeleteFolder: (folderPath: string) => Promise<void>;
}

const FolderChildren: React.FC<FolderNodeProps> = ({
  node,
  level,
  onCreateNote,
  onRenameFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const { activeFolder, expandedPaths, setActiveFolder, toggleExpanded, setSelectedFile, counts } =
    useFileTreeStore();

  const normalizedPath = normalizePath(node.path);
  const childFolders = node.children ?? [];

  const hasChildren = childFolders.length > 0;
  const isExpanded = expandedPaths.has(normalizedPath);
  const isActive = normalizePath(activeFolder || '') === normalizedPath;
  const isRootFolder = normalizedPath.length === 0;

  const noteCount = counts[normalizedPath || '__root__'] || 0;

  return (
    <>
      <TreeItem
        level={level}
        isActive={isActive}
        onClick={(event) => {
          event.stopPropagation();
          const willExpand = !isExpanded;
          if (!willExpand) {
            const parent = getParentPath(normalizedPath);
            setActiveFolder(parent || null);
          }
          toggleExpanded(normalizedPath);
          if (willExpand) {
            setActiveFolder(normalizedPath || null);
          }
          setSelectedFile(null);
        }}
        icon={
          isExpanded ? (
            <FolderOpen size={14} className="text-muted-foreground" />
          ) : (
            <FolderSimple size={14} className="text-muted-foreground" />
          )
        }
        label={node.name}
        rightSlotProps={{
          className: 'flex items-center gap-1',
          onClick: (event) => event.stopPropagation(),
          onPointerDown: (event) => event.stopPropagation(),
          onPointerUp: (event) => event.stopPropagation(),
        }}
        right={
          <>
            <Text size="xs" variant="muted">
              {noteCount}
            </Text>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  size="compact"
                  icon={<DotsThreeVertical size={14} />}
                  label="Folder options"
                  tooltip="Folder options"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={() => {
                    setActiveFolder(null);
                    setSelectedFile(null);
                  }}
                >
                  <Files size={14} className="mr-2 text-muted-foreground" />
                  <Text size="xs">All Notes</Text>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await onCreateNote(normalizedPath);
                  }}
                >
                  <Plus size={14} className="mr-2 text-muted-foreground" />
                  <Text size="xs">New Note</Text>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isRootFolder}
                  onSelect={() => {
                    if (!isRootFolder) {
                      onRenameFolder(normalizedPath, node.name);
                    }
                  }}
                >
                  <PencilSimple size={14} className="mr-2 text-muted-foreground" />
                  <Text size="xs">Rename Folder</Text>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={isRootFolder}
                  onSelect={async () => {
                    if (!isRootFolder) {
                      await onDeleteFolder(normalizedPath);
                    }
                  }}
                >
                  <Trash size={14} className="mr-2 text-muted-foreground" />
                  <Text size="xs">Delete Folder</Text>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {hasChildren && isExpanded && (
        <div>
          {(node.children ?? []).map((child) =>
            child.type === 'folder' ? (
              <FolderChildren
                key={`folder-${child.path}`}
                node={child}
                level={level + 1}
                onCreateNote={onCreateNote}
                onRenameFile={onRenameFile}
                onDeleteFile={onDeleteFile}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
              />
            ) : (
              <FileLeaf
                key={`file-${child.path}`}
                node={child}
                level={level + 1}
                onRename={onRenameFile}
                onDelete={onDeleteFile}
              />
            ),
          )}
        </div>
      )}
    </>
  );
};

export function FileTree() {
  const { tree, activeFolder, setActiveFolder, setSelectedFile } = useFileTreeStore();
  const { setActiveNote } = useNoteStore();
  const { createNote, updateNote, deleteNote } = useNoteAPI();
  const { loadFileTree, createFolder, renameFolder, deleteFolder } = useFileTreeAPI();
  const [renameTarget, setRenameTarget] = useState<{ noteId: string; title: string } | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<{
    path: string;
    name: string;
  } | null>(null);

  const handleCreateNoteInFolder = async (folderPath: string | null) => {
    try {
      // Generate a default title for the new note
      const now = new Date();
      const defaultTitle = `Note ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

      const note = await createNote({
        title: defaultTitle,
        content: '',
        folderPath: folderPath || undefined,
      });
      if (note) {
        setActiveFolder(folderPath || null);
        if (note.filePath) {
          setSelectedFile(note.filePath.replace(/\\/g, '/'));
        }
        setActiveNote(note.id);
        await loadFileTree();
      }
    } catch (error) {
      console.error('Failed to create note in folder', error);
    }
  };

  const handleRenameNote = async (noteId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    try {
      await updateNote(noteId, { title: trimmed });
      await loadFileTree();
    } catch (error) {
      console.error('Failed to rename note', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const confirmed = window.confirm('Move this note to the trash?');
    if (!confirmed) return;
    try {
      const success = await deleteNote(noteId, false);
      if (success) {
        await loadFileTree();
      }
    } catch (error) {
      console.error('Failed to delete note', error);
    }
  };

  const handleRenameFolder = async (folderPath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const updatedPath = await renameFolder(folderPath, trimmed);
      await loadFileTree();
      const nextPath = normalizePath(updatedPath || folderPath);
      setActiveFolder(nextPath || null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Failed to rename folder', error);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    const confirmed = window.confirm(
      'Delete this folder and all notes within it? This action cannot be undone.',
    );
    if (!confirmed) return;

    try {
      const success = await deleteFolder(folderPath);
      if (success) {
        await loadFileTree();
        const parent = getParentPath(folderPath);
        setActiveFolder(parent || null);
        setSelectedFile(null);
        if (renameFolderTarget?.path === folderPath) {
          setRenameFolderTarget(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete folder', error);
    }
  };

  return (
    <div>
      {tree.map((node) =>
        node.type === 'folder' ? (
          <FolderChildren
            key={`folder-${node.path || node.name}`}
            node={node}
            level={0}
            onCreateNote={handleCreateNoteInFolder}
            onRenameFile={(noteId, title) => setRenameTarget({ noteId, title })}
            onDeleteFile={handleDeleteNote}
            onRenameFolder={(path, name) =>
              setRenameFolderTarget({ path: normalizePath(path), name })
            }
            onDeleteFolder={handleDeleteFolder}
          />
        ) : (
          <FileLeaf
            key={`file-${node.path}`}
            node={node}
            level={0}
            onRename={(noteId, title) => setRenameTarget({ noteId, title })}
            onDelete={handleDeleteNote}
          />
        ),
      )}
      <InputModal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={async (value) => {
          if (renameTarget) {
            await handleRenameNote(renameTarget.noteId, value);
            setRenameTarget(null);
          }
        }}
        title="Rename Note"
        placeholder="Note title"
        submitLabel="Rename"
        defaultValue={renameTarget?.title ?? ''}
      />
      <InputModal
        isOpen={!!renameFolderTarget}
        onClose={() => setRenameFolderTarget(null)}
        onSubmit={async (value) => {
          if (renameFolderTarget) {
            await handleRenameFolder(renameFolderTarget.path, value);
            setRenameFolderTarget(null);
          }
        }}
        title="Rename Folder"
        placeholder="Folder name"
        submitLabel="Rename"
        defaultValue={renameFolderTarget?.name ?? ''}
      />
    </div>
  );
}
