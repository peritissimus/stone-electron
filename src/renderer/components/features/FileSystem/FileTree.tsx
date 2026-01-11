/**
 * FileTree Component - File system tree navigation
 *
 * Implements: specs/components.ts#FileTreeProps
 */

import React, { useState, useCallback } from 'react';
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
import { IconButton } from '@renderer/components/composites';
import { Text, Heading3 } from '@renderer/components/base/ui/text';
import {
  useFileTreeStore,
  FileTreeNode as StoreFileTreeNode,
} from '@renderer/stores/fileTreeStore';
import { useNoteStore } from '@renderer/stores/noteStore';
import { InputModal } from '@renderer/components/composites';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { cn } from '@renderer/lib/utils';
import { logger } from '@renderer/utils/logger';
import { normalizePath, getParentPath, getDisplayName } from '@renderer/utils/path';

interface FileTreeFileProps {
  node: StoreFileTreeNode;
  level: number;
  onRename: (noteId: string, currentTitle: string) => void;
  onDelete: (noteId: string) => Promise<void>;
  onMove: (noteId: string, destinationPath: string | null) => Promise<void>;
}

const FileLeaf = React.memo<FileTreeFileProps>(({ node, level, onRename, onDelete, onMove: _onMove }) => {
  const normalizedPath = normalizePath(node.path);

  // Simplified selectors - Zustand handles equality checks internally
  const setSelectedFile = useFileTreeStore((state) => state.setSelectedFile);
  const setActiveFolder = useFileTreeStore((state) => state.setActiveFolder);

  const setActiveNote = useNoteStore((state) => state.setActiveNote);
  const activeNoteId = useNoteStore((state) => state.activeNoteId);
  const notesByPath = useNoteStore((state) => state.notesByPath);
  const note = notesByPath.get(normalizedPath);

  const { loadNoteByPath } = useNoteAPI();

  // Active state based on whether this note is the currently active note
  const isActive = note?.id === activeNoteId;

  const [isDragOver, _setIsDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const parentPath = getParentPath(normalizedPath);
  const folderForSelection = parentPath || null;

  const handleOpen = async () => {
    logger.info('[FileTree] Opening file', {
      normalizedPath,
      folderForSelection,
      fileName: node.name,
    });

    setActiveFolder(folderForSelection);
    setSelectedFile(normalizedPath);

    // Try to find note in store first (fast path)
    const currentNotesByPath = useNoteStore.getState().notesByPath;
    const cachedNote = currentNotesByPath.get(normalizedPath);

    if (cachedNote) {
      logger.info('[FileTree] Found note in cache', {
        noteId: cachedNote.id,
        noteTitle: cachedNote.title,
      });
      setActiveNote(cachedNote.id);
    } else {
      // Note not in store - load it via hook (Obsidian-style)
      logger.info('[FileTree] Note not in cache, loading via hook', { normalizedPath });
      const loadedNote = await loadNoteByPath(normalizedPath);
      if (loadedNote) {
        logger.info('[FileTree] Loaded note via hook', {
          noteId: loadedNote.id,
          noteTitle: loadedNote.title,
        });
        setActiveNote(loadedNote.id);
      } else {
        logger.warn('[FileTree] No note found for file path', { normalizedPath });
      }
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!note) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(
      'application/stone-note',
      JSON.stringify({
        noteId: note.id,
        filePath: normalizedPath,
        type: 'file',
      }),
    );
    // Add visual feedback
    (e.target as HTMLElement).style.opacity = '0.4';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '';
  };

  return (
    <div
      draggable={!!note}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn('relative group transition-all duration-150', isDragOver && 'opacity-50')}
    >
      <div
        className={cn(
          'relative flex items-center h-7 px-2 rounded cursor-pointer transition-all duration-150',
          isActive ? 'bg-accent/40' : 'hover:bg-accent/20',
        )}
        onClick={handleOpen}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <FileText
          size={14}
          className={cn(
            'mr-2 flex-shrink-0 transition-colors duration-150',
            isActive ? 'text-foreground' : 'text-muted-foreground',
            isHovered && !isActive && 'text-foreground/70',
          )}
        />
        <span
          className={cn(
            'flex-1 text-xs truncate transition-colors duration-150',
            isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
          )}
        >
          {note?.title?.trim() ? note.title : getDisplayName(node.name)}
        </span>

        {/* Context menu - only visible on hover */}
        <div
          className={cn(
            'ml-auto opacity-0 transition-opacity duration-150',
            isHovered && 'opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="compact"
                icon={<DotsThreeVertical size={14} />}
                label="File options"
                className="h-5 w-5 hover:bg-accent"
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
        </div>
      </div>
    </div>
  );
});

FileLeaf.displayName = 'FileLeaf';

interface FolderNodeProps {
  node: StoreFileTreeNode;
  level: number;
  onCreateNote: (folderPath: string | null) => Promise<void>;
  onRenameFile: (noteId: string, currentTitle: string) => void;
  onDeleteFile: (noteId: string) => Promise<void>;
  onMoveFile: (noteId: string, destinationPath: string | null) => Promise<void>;
  onRenameFolder: (folderPath: string, currentName: string) => void;
  onDeleteFolder: (folderPath: string) => Promise<void>;
  onMoveFolder: (sourcePath: string, destinationPath: string | null) => Promise<void>;
}

const FolderChildren = React.memo<FolderNodeProps>(
  ({
    node,
    level,
    onCreateNote,
    onRenameFile,
    onDeleteFile,
    onMoveFile,
    onRenameFolder,
    onDeleteFolder,
    onMoveFolder,
  }) => {
    const normalizedPath = normalizePath(node.path);

    // Simplified selectors - Zustand handles equality checks internally
    const expandedPaths = useFileTreeStore((state) => state.expandedPaths);
    const activeFolder = useFileTreeStore((state) => state.activeFolder);
    const isExpanded = expandedPaths.has(normalizedPath);
    const isActive = normalizePath(activeFolder || '') === normalizedPath;
    const setActiveFolder = useFileTreeStore((state) => state.setActiveFolder);
    const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded);
    const setSelectedFile = useFileTreeStore((state) => state.setSelectedFile);

    const [isDragOver, setIsDragOver] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const childFolders = node.children ?? [];

    const hasChildren = childFolders.length > 0;
    const isRootFolder = normalizedPath.length === 0;

    const handleDragStart = (e: React.DragEvent) => {
      if (isRootFolder) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(
        'application/stone-folder',
        JSON.stringify({
          folderPath: normalizedPath,
          type: 'folder',
        }),
      );
      (e.target as HTMLElement).style.opacity = '0.4';
    };

    const handleDragEnd = (e: React.DragEvent) => {
      (e.target as HTMLElement).style.opacity = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      logger.info('[FileTree] Drop event on folder', {
        targetPath: normalizedPath,
        folderName: node.name,
      });

      // Try to get note data
      const noteData = e.dataTransfer.getData('application/stone-note');
      if (noteData) {
        try {
          const { noteId, filePath } = JSON.parse(noteData);
          logger.info('[FileTree] Moving note', {
            noteId,
            fromPath: filePath,
            toPath: normalizedPath || 'root',
          });
          await onMoveFile(noteId, normalizedPath || null);
        } catch (error) {
          logger.error('[FileTree] Failed to move note', {
            error,
            noteData,
            targetPath: normalizedPath,
          });
        }
        return;
      }

      // Try to get folder data
      const folderData = e.dataTransfer.getData('application/stone-folder');
      if (folderData) {
        try {
          const { folderPath } = JSON.parse(folderData);
          // Prevent dropping a folder into itself or its children
          if (folderPath === normalizedPath || normalizedPath.startsWith(folderPath + '/')) {
            return;
          }
          await onMoveFolder(folderPath, normalizedPath || null);
        } catch (error) {
          logger.error('Failed to move folder:', error);
        }
      }
    };

    const handleClick = (event: React.MouseEvent) => {
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
    };

    return (
      <>
        <div
          draggable={!isRootFolder}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'relative group transition-all duration-150',
            isDragOver && 'ring-2 ring-primary/20 ring-offset-1 rounded',
          )}
        >
          <div
            className={cn(
              'relative flex items-center h-7 px-2 rounded cursor-pointer transition-all duration-150',
              'hover:bg-accent/20',
            )}
            onClick={handleClick}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
          >
            {isExpanded ? (
              <FolderOpen
                size={14}
                className={cn(
                  'mr-2 flex-shrink-0 transition-colors duration-150',
                  'text-muted-foreground',
                  isHovered && 'text-foreground/70',
                )}
              />
            ) : (
              <FolderSimple
                size={14}
                className={cn(
                  'mr-2 flex-shrink-0 transition-colors duration-150',
                  'text-muted-foreground',
                  isHovered && 'text-foreground/70',
                )}
              />
            )}
            <span
              className={cn(
                'flex-1 text-xs truncate transition-colors duration-150',
                isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              {node.name}
            </span>

            {/* Context menu - only visible on hover */}
            <div
              className={cn(
                'ml-auto opacity-0 transition-opacity duration-150',
                isHovered && 'opacity-100',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    size="compact"
                    icon={<DotsThreeVertical size={14} />}
                    label="Folder options"
                    className="h-5 w-5 hover:bg-accent"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={() => {
                      setActiveFolder(null);
                      setSelectedFile(null);
                    }}
                  >
                    <Files size={14} className="mr-2 text-muted-foreground" />
                    <Text size="xs">Show All Notes</Text>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={async () => {
                      await onCreateNote(normalizedPath);
                    }}
                  >
                    <Plus size={14} className="mr-2 text-muted-foreground" />
                    <Text size="xs">New Note Here</Text>
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
            </div>
          </div>
        </div>
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
                  onMoveFile={onMoveFile}
                  onRenameFolder={onRenameFolder}
                  onDeleteFolder={onDeleteFolder}
                  onMoveFolder={onMoveFolder}
                />
              ) : (
                <FileLeaf
                  key={`file-${child.path}`}
                  node={child}
                  level={level + 1}
                  onRename={onRenameFile}
                  onDelete={onDeleteFile}
                  onMove={onMoveFile}
                />
              ),
            )}
          </div>
        )}
      </>
    );
  },
);

FolderChildren.displayName = 'FolderChildren';

export function FileTree() {
  const { tree, activeFolder, setActiveFolder, setSelectedFile } = useFileTreeStore();
  const { setActiveNote } = useNoteStore();
  const { createNote, updateNote, deleteNote, moveNote } = useNoteAPI();
  const { loadFileTree, renameFolder, deleteFolder, moveFolder } = useFileTreeAPI();
  const [renameTarget, setRenameTarget] = useState<{ noteId: string; title: string } | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<{
    path: string;
    name: string;
  } | null>(null);

  const handleCreateNoteInFolder = useCallback(
    async (folderPath: string | null) => {
      logger.info('[FileTree] Creating note in folder', { folderPath });
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
        logger.error('Failed to create note in folder', error);
      }
    },
    [createNote, setActiveFolder, setSelectedFile, setActiveNote, loadFileTree],
  );

  const handleRenameNote = useCallback(
    async (noteId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      try {
        await updateNote(noteId, { title: trimmed });
        // No need to reload file tree - filename doesn't change, only title
        // updateNote already updates the note in the store
      } catch (error) {
        logger.error('Failed to rename note', error);
      }
    },
    [updateNote],
  );

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const confirmed = window.confirm(
        'Are you sure you want to delete this note? This cannot be undone.',
      );
      if (!confirmed) return;
      try {
        const success = await deleteNote(noteId, true);
        if (success) {
          await loadFileTree();
        }
      } catch (error) {
        logger.error('Failed to delete note', error);
      }
    },
    [deleteNote, loadFileTree],
  );

  const handleRenameFolder = useCallback(
    async (folderPath: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      try {
        const updatedPath = await renameFolder(folderPath, trimmed);
        await loadFileTree();
        const nextPath = normalizePath(updatedPath || folderPath);
        setActiveFolder(nextPath || null);
        setSelectedFile(null);
      } catch (error) {
        logger.error('Failed to rename folder', error);
      }
    },
    [renameFolder, loadFileTree, setActiveFolder, setSelectedFile],
  );

  const handleDeleteFolder = useCallback(
    async (folderPath: string) => {
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
        logger.error('Failed to delete folder', error);
      }
    },
    [deleteFolder, loadFileTree, setActiveFolder, setSelectedFile, renameFolderTarget],
  );

  const handleMoveNote = useCallback(
    async (noteId: string, destinationPath: string | null) => {
      logger.info('[FileTree] Moving note', { noteId, destinationPath });
      try {
        await moveNote(noteId, destinationPath);
        logger.info('[FileTree] Note moved successfully, reloading tree');
        await loadFileTree();
      } catch (error) {
        logger.error('[FileTree] Failed to move note', { error, noteId, destinationPath });
      }
    },
    [moveNote, loadFileTree],
  );

  const handleMoveFolder = useCallback(
    async (sourcePath: string, destinationPath: string | null) => {
      logger.info('[FileTree] Moving folder', { sourcePath, destinationPath });
      try {
        await moveFolder(sourcePath, destinationPath);
        logger.info('[FileTree] Folder moved successfully, reloading tree');
        await loadFileTree();
      } catch (error) {
        logger.error('[FileTree] Failed to move folder', { error, sourcePath, destinationPath });
      }
    },
    [moveFolder, loadFileTree],
  );

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
            onMoveFile={handleMoveNote}
            onRenameFolder={(path, name) =>
              setRenameFolderTarget({ path: normalizePath(path), name })
            }
            onDeleteFolder={handleDeleteFolder}
            onMoveFolder={handleMoveFolder}
          />
        ) : (
          <FileLeaf
            key={`file-${node.path}`}
            node={node}
            level={0}
            onRename={(noteId, title) => setRenameTarget({ noteId, title })}
            onDelete={handleDeleteNote}
            onMove={handleMoveNote}
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
        left={<Heading3>Rename Note</Heading3>}
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
        left={<Heading3>Rename Folder</Heading3>}
        placeholder="Folder name"
        submitLabel="Rename"
        defaultValue={renameFolderTarget?.name ?? ''}
      />
    </div>
  );
}
