import React, { useMemo, useState } from 'react';
import {
  FileText,
  FolderSimple,
  FolderOpen,
  Files,
  DotsThreeVertical,
  PencilSimple,
  Trash,
  Plus,
} from 'phosphor-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu';
import { Button } from '@renderer/components/ui/button';
import { IconButton, TreeItem } from '@renderer/components/composites';
import { Text } from '@renderer/components/ui/text';
import {
  useFileTreeStore,
  FileTreeNode as StoreFileTreeNode,
} from '@renderer/stores/fileTreeStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { InputModal } from '@renderer/components/Common';
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
      right={
        <div
          className="flex items-center gap-1"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" aria-label="File options">
                <DotsThreeVertical size={14} />
              </Button>
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
                <PencilSimple size={8} className="mr-2" />
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
                <Trash size={8} className="mr-2" />
                <Text size="xs">Delete</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
}

const FolderChildren: React.FC<FolderNodeProps> = ({
  node,
  level,
  onCreateNote,
  onRenameFile,
  onDeleteFile,
}) => {
  const { activeFolder, expandedPaths, setActiveFolder, toggleExpanded, setSelectedFile, counts } =
    useFileTreeStore();

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
        right={
          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Text size="xs" variant="muted" className="text-[10px]">
              {noteCount}
            </Text>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton size="compact" icon={<DotsThreeVertical size={14} />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={async () => {
                    await onCreateNote(normalizedPath);
                  }}
                >
                  <Plus size={14} className="mr-2" /> New Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
  const { notes, setActiveNote } = useNoteStore();
  const { createNote, updateNote, deleteNote } = useNoteAPI();
  const { loadFileTree } = useFileTreeAPI();
  const allNotesCount = useMemo(() => notes.filter((n) => !n.isDeleted).length, [notes]);
  const [renameTarget, setRenameTarget] = useState<{ noteId: string; title: string } | null>(null);

  const handleCreateNoteInFolder = async (folderPath: string | null) => {
    try {
      const note = await createNote({
        title: '',
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
    </div>
  );
}
