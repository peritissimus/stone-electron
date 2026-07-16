/**
 * FileTree Component - container that wires actions and renders folder/file nodes.
 *
 * Implements: specs/components.ts#FileTreeProps
 */

import React, { useState, useCallback } from 'react';
import { Heading3 } from '@renderer/components/base/ui/text';
import { InputModal } from '@renderer/components/composites';
import { useFileTree } from '@renderer/services/workspace/hooks/useFileTree';
import { useNoteAPI } from '@renderer/features/notes/commands/useNoteAPI';
import { useFileTreeAPI } from '@renderer/services/workspace/commands/useFileTreeAPI';
import { useNavigateToNote } from '@renderer/services/navigation';
import { logger } from '@renderer/services/telemetry/logger';
import { FileLeaf } from './FileLeaf';
import { FolderNode } from './FolderNode';

export function FileTree() {
  const navigateToNote = useNavigateToNote();
  const { tree } = useFileTree();
  const { createNote, updateNote, deleteNote, moveNote } = useNoteAPI();
  const { loadFileTree, moveFolder } = useFileTreeAPI();
  const [renameTarget, setRenameTarget] = useState<{ noteId: string; title: string } | null>(null);

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
          navigateToNote(note.id);
          await loadFileTree();
        }
      } catch (error) {
        logger.error('Failed to create note in folder', error);
      }
    },
    [createNote, navigateToNote, loadFileTree],
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
    <div className="space-y-0.5">
      <div className="mb-1 flex h-8 items-center px-2">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground/80">
          Files
        </span>
      </div>
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
    </div>
  );
}
