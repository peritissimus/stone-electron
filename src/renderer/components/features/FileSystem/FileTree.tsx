/**
 * FileTree Component - container that wires actions and renders folder/file nodes.
 *
 * Implements: specs/components.ts#FileTreeProps
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heading3 } from '@renderer/components/base/ui/text';
import { InputModal } from '@renderer/components/composites';
import { useFileTree } from '@renderer/hooks/useFileTree';
import { useNoteAPI } from '@renderer/hooks/useNoteAPI';
import { useFileTreeAPI } from '@renderer/hooks/useFileTreeAPI';
import { logger } from '@renderer/lib/logger';
import { normalizePath, getParentPath } from '@renderer/lib/path';
import { FileLeaf } from './FileLeaf';
import { FolderNode } from './FolderNode';

export function FileTree() {
  const navigate = useNavigate();
  const { tree, setActiveFolder, setSelectedFile } = useFileTree();
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
          navigate(`/note/${note.id}`);
          await loadFileTree();
        }
      } catch (error) {
        logger.error('Failed to create note in folder', error);
      }
    },
    [createNote, setActiveFolder, setSelectedFile, navigate, loadFileTree],
  );

  const handleRenameNote = useCallback(
    async (noteId: string, newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) return;
      try {
        await updateNote(noteId, { title: trimmed });
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
          <FolderNode
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
